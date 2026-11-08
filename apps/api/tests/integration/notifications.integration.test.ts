import "dotenv/config";

import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import notificationRoutes from "../../src/routes/notificationRoutes";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { pool } from "../../src/config/database";
import { signAccessToken } from "../../src/utils/jwt";
import { notifyUser } from "../../src/services/notificationService";

// ==================================================
// TYPES
// ==================================================

type TestUser = {
  id: string;
  accessToken: string;
};

// ==================================================
// TEST DATABASE SAFETY
// ==================================================

const databaseUrl = process.env.DATABASE_URL;
const expectedTestHost = process.env.TEST_DATABASE_HOST;

if (!databaseUrl || !expectedTestHost) {
  throw new Error(
    "DATABASE_URL and TEST_DATABASE_HOST must be configured in .env.test",
  );
}

if (new URL(databaseUrl).hostname !== expectedTestHost) {
  throw new Error(
    "Refusing to run notification integration tests: wrong database host.",
  );
}

// ==================================================
// TEST APPLICATION
// ==================================================

const app = express();

app.use(express.json());
app.use("/api/v1/notifications", notificationRoutes);
app.use(errorHandler);

// ==================================================
// TEST DATA
// ==================================================

const createdUserIds: string[] = [];

let recipient: TestUser;
let otherUser: TestUser;
let serviceRecipient: TestUser;

let recipientNotificationIds: string[] = [];
let otherUserNotificationId: string;

async function createTestUser(): Promise<TestUser> {
  const email = `notification-${randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, 'buyer', 'approved', NOW())
     RETURNING id`,
    ["Notification Test User", email, "unused-test-password-hash"],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create notification test user.");
  }

  createdUserIds.push(user.id);

  return {
    id: user.id,
    accessToken: await signAccessToken({
      userId: user.id,
      role: "buyer",
    }),
  };
}

async function createTestNotification(recipientId: string, title: string) {
  return notifyUser({
    recipientId,
    type: "test_notification",
    title,
    message: `Test notification: ${title}`,
  });
}

function authenticated(user: TestUser) {
  return {
    Authorization: `Bearer ${user.accessToken}`,
  };
}

// ==================================================
// SHARED SETUP
// ==================================================

beforeAll(async () => {
  recipient = await createTestUser();
  otherUser = await createTestUser();

  // Separate recipient for direct service tests.
  // This prevents service tests from changing API pagination
  // and unread-count expectations.
  serviceRecipient = await createTestUser();

  // Notifications used by API tests.
  const first = await createTestNotification(
    recipient.id,
    "Recipient notification 1",
  );

  const second = await createTestNotification(
    recipient.id,
    "Recipient notification 2",
  );

  const third = await createTestNotification(
    recipient.id,
    "Recipient notification 3",
  );

  const other = await createTestNotification(
    otherUser.id,
    "Other user's notification",
  );

  recipientNotificationIds = [first.id, second.id, third.id];

  otherUserNotificationId = other.id;
});

// ==================================================
// CLEANUP
// ==================================================

afterAll(async () => {
  if (createdUserIds.length > 0) {
    // Delete only notifications belonging to test users.
    // Then remove the temporary users.
    await pool.query(
      `DELETE FROM notifications
       WHERE recipient_id = ANY($1::uuid[])`,
      [createdUserIds],
    );

    await pool.query(
      `DELETE FROM users
       WHERE id = ANY($1::uuid[])`,
      [createdUserIds],
    );
  }

  await pool.end();
});

// ==================================================
// NOTIFICATION SERVICE INTEGRATION TESTS
// ==================================================

describe("Notification service integration tests", () => {
  describe("notifyUser", () => {
    it("creates a notification with valid input", async () => {
      const notification = await notifyUser({
        recipientId: serviceRecipient.id,
        type: "test_notification",
        title: "Test notification",
        message: "This is a test notification.",
        entityType: "property",
        entityId: randomUUID(),
      });

      expect(notification).toMatchObject({
        recipient_id: serviceRecipient.id,
        type: "test_notification",
        title: "Test notification",
        message: "This is a test notification.",
        entity_type: "property",
        is_read: false,
        read_at: null,
      });

      expect(notification.id).toBeDefined();
      expect(notification.created_at).toBeDefined();
    });

    it("rejects an invalid recipient UUID", async () => {
      await expect(
        notifyUser({
          recipientId: "invalid-uuid",
          type: "test_notification",
          title: "Test notification",
          message: "This is a test notification.",
        }),
      ).rejects.toThrow();
    });

    it("rejects an empty notification type", async () => {
      await expect(
        notifyUser({
          recipientId: serviceRecipient.id,
          type: " ",
          title: "Test notification",
          message: "This is a test notification.",
        }),
      ).rejects.toThrow();
    });

    it("rejects an empty notification title", async () => {
      await expect(
        notifyUser({
          recipientId: serviceRecipient.id,
          type: "test_notification",
          title: " ",
          message: "This is a test notification.",
        }),
      ).rejects.toThrow();
    });

    it("rejects a title longer than 150 characters", async () => {
      await expect(
        notifyUser({
          recipientId: serviceRecipient.id,
          type: "test_notification",
          title: "A".repeat(151),
          message: "This is a test notification.",
        }),
      ).rejects.toThrow();
    });

    it("rejects an empty notification message", async () => {
      await expect(
        notifyUser({
          recipientId: serviceRecipient.id,
          type: "test_notification",
          title: "Test notification",
          message: " ",
        }),
      ).rejects.toThrow();
    });

    it("rejects an invalid entity UUID", async () => {
      await expect(
        notifyUser({
          recipientId: serviceRecipient.id,
          type: "test_notification",
          title: "Test notification",
          message: "This is a test notification.",
          entityType: "property",
          entityId: "invalid-uuid",
        }),
      ).rejects.toThrow();
    });
  });
});

// ==================================================
// NOTIFICATION API INTEGRATION TESTS
// ==================================================

describe("Notification API integration tests", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/api/v1/notifications");

    expect(response.status).toBe(401);
  });

  it("lists only the authenticated user's notifications with pagination", async () => {
    const response = await request(app)
      .get("/api/v1/notifications?page=1&limit=2")
      .set(authenticated(recipient));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(2);
    expect(response.body.total).toBe(3);

    for (const notification of response.body.items) {
      expect(recipientNotificationIds).toContain(notification.id);
      expect(notification.recipient_id).toBe(recipient.id);
    }
  });

  it("filters unread notifications", async () => {
    const notificationId = recipientNotificationIds[0];

    await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(authenticated(recipient));

    const response = await request(app)
      .get("/api/v1/notifications?unreadOnly=true")
      .set(authenticated(recipient));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);

    for (const notification of response.body.items) {
      expect(notification.is_read).toBe(false);
    }
  });

  it("rejects invalid pagination and filter parameters", async () => {
    const invalidPage = await request(app)
      .get("/api/v1/notifications?page=0")
      .set(authenticated(recipient));

    expect(invalidPage.status).toBe(400);
    expect(invalidPage.body.code).toBe("INVALID_NOTIFICATION_QUERY");

    const invalidFilter = await request(app)
      .get("/api/v1/notifications?unreadOnly=yes")
      .set(authenticated(recipient));

    expect(invalidFilter.status).toBe(400);
  });

  it("returns the unread count for the authenticated user only", async () => {
    const response = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authenticated(recipient));

    expect(response.status).toBe(200);
    expect(response.body.unreadCount).toBe(2);
  });

  it("marks one notification as read", async () => {
    const notificationId = recipientNotificationIds[1];

    const response = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(authenticated(recipient));

    expect(response.status).toBe(200);
    expect(response.body.notification.id).toBe(notificationId);
    expect(response.body.notification.is_read).toBe(true);
    expect(response.body.notification.read_at).not.toBeNull();
  });

  it("returns the existing record when marking an already-read notification as read", async () => {
    const notificationId = recipientNotificationIds[1];

    const response = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(authenticated(recipient));

    expect(response.status).toBe(200);
    expect(response.body.notification.is_read).toBe(true);
  });

  it("does not allow a user to mark another user's notification as read", async () => {
    const response = await request(app)
      .patch(`/api/v1/notifications/${otherUserNotificationId}/read`)
      .set(authenticated(recipient));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("marks all remaining notifications as read for the authenticated user only", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set(authenticated(recipient));

    expect(response.status).toBe(200);
    expect(response.body.updatedCount).toBe(1);

    const recipientCount = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authenticated(recipient));

    const otherUserCount = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authenticated(otherUser));

    expect(recipientCount.body.unreadCount).toBe(0);
    expect(otherUserCount.body.unreadCount).toBe(1);
  });
});
