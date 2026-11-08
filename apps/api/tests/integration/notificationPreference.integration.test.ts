import "dotenv/config";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import notificationPreferenceRoutes from "../../src/routes/notificationPreferenceRoutes";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { pool } from "../../src/config/database";
import { signAccessToken } from "../../src/utils/jwt";
import { notifyUser } from "../../src/services/notificationService";

type TestUser = {
  id: string;
  accessToken: string;
};

const databaseUrl = process.env.DATABASE_URL;
const expectedTestHost = process.env.TEST_DATABASE_HOST;

if (!databaseUrl || !expectedTestHost) {
  throw new Error(
    "DATABASE_URL and TEST_DATABASE_HOST must be configured in .env.test",
  );
}

if (new URL(databaseUrl).hostname !== expectedTestHost) {
  throw new Error(
    "Refusing to run notification preference tests: wrong database host.",
  );
}

const app = express();

app.use(express.json());
app.use("/api/v1/notifications/preferences", notificationPreferenceRoutes);
app.use(errorHandler);

const createdUserIds: string[] = [];

let user: TestUser;
let otherUser: TestUser;

async function createTestUser(): Promise<TestUser> {
  const email = `notification-preference-${crypto.randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name, email, password_hash, role, status, email_verified_at
     )
     VALUES ($1, $2, $3, 'buyer', 'approved', NOW())
     RETURNING id`,
    ["Notification Preference Test User", email, "unused-test-password-hash"],
  );

  const createdUser = result.rows[0];

  if (!createdUser) {
    throw new Error("Failed to create notification preference test user.");
  }

  createdUserIds.push(createdUser.id);

  return {
    id: createdUser.id,
    accessToken: await signAccessToken({
      userId: createdUser.id,
      role: "buyer",
    }),
  };
}

function authenticated(testUser: TestUser) {
  return {
    Authorization: `Bearer ${testUser.accessToken}`,
  };
}

beforeAll(async () => {
  user = await createTestUser();
  otherUser = await createTestUser();
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
      createdUserIds,
    ]);
  }
});

describe("Notification preference integration", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get(
      "/api/v1/notifications/preferences",
    );

    expect(response.status).toBe(401);
  });

  it("returns all supported notification types enabled by default", async () => {
    const response = await request(app)
      .get("/api/v1/notifications/preferences")
      .set(authenticated(user));

    expect(response.status).toBe(200);
    expect(response.body.preferences).toHaveLength(4);

    for (const preference of response.body.preferences) {
      expect(preference.isEnabled).toBe(true);
    }
  });

  it("disables a notification type", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/preferences")
      .set(authenticated(user))
      .send({
        notificationType: "commission_approved",
        isEnabled: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.preference.notification_type).toBe(
      "commission_approved",
    );
    expect(response.body.preference.is_enabled).toBe(false);
  });

  it("persists the updated preference", async () => {
    const response = await request(app)
      .get("/api/v1/notifications/preferences")
      .set(authenticated(user));

    expect(response.status).toBe(200);

    const preference = response.body.preferences.find(
      (item: { notificationType: string }) =>
        item.notificationType === "commission_approved",
    );

    expect(preference.isEnabled).toBe(false);
  });

  it("does not create a notification when its type is disabled", async () => {
    const notification = await notifyUser({
      recipientId: user.id,
      type: "commission_approved",
      title: "Test commission approval",
      message: "This notification should be suppressed.",
    });

    expect(notification).toBeNull();

    const result = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_id = $1
         AND type = 'commission_approved'`,
      [user.id],
    );

    expect(result.rows[0].count).toBe(0);
  });

  it("still creates notifications for enabled types", async () => {
    const notification = await notifyUser({
      recipientId: user.id,
      type: "commission_payment_recorded",
      title: "Test commission payment",
      message: "This notification should be created.",
    });

    expect(notification).not.toBeNull();
    expect(notification.type).toBe("commission_payment_recorded");
  });

  it("re-enables a previously disabled notification type", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/preferences")
      .set(authenticated(user))
      .send({
        notificationType: "commission_approved",
        isEnabled: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.preference.is_enabled).toBe(true);

    const notification = await notifyUser({
      recipientId: user.id,
      type: "commission_approved",
      title: "Commission approved again",
      message: "This notification should now be created.",
    });

    expect(notification).not.toBeNull();
  });

  it("does not allow unsupported notification types", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/preferences")
      .set(authenticated(user))
      .send({
        notificationType: "unknown_notification",
        isEnabled: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_NOTIFICATION_PREFERENCE");
  });

  it("does not allow invalid preference values", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/preferences")
      .set(authenticated(user))
      .send({
        notificationType: "commission_approved",
        isEnabled: "false",
      });

    expect(response.status).toBe(400);
  });

  it("keeps preferences isolated between users", async () => {
    const response = await request(app)
      .get("/api/v1/notifications/preferences")
      .set(authenticated(otherUser));

    expect(response.status).toBe(200);

    const preference = response.body.preferences.find(
      (item: { notificationType: string }) =>
        item.notificationType === "commission_approved",
    );

    expect(preference.isEnabled).toBe(true);
  });
});
