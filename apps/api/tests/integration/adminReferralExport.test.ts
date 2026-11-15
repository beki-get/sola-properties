
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../../src/services/emailService", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import type { AppRole } from "../../src/queries/authQueries";
import { pool } from "../../src/config/database";
import app from "../../src/app";
import { signAccessToken } from "../../src/utils/jwt";

const testUserIds: string[] = [];
const testPropertyIds: string[] = [];
const testCategoryIds: string[] = [];
const testLocationIds: string[] = [];
const testReferralIds: string[] = [];

type TestRole = Extract<AppRole, "admin" | "buyer" | "agent">;

async function createTestUser(role: TestRole, fullName: string) {
  const email = `referral-export-${randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name, email, password_hash, role, status, email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, 'approved', NOW())
     RETURNING id`,
    [fullName, email, "test-only-password-hash", role],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test user.");

  testUserIds.push(id);

  return {
    id,
    token: await signAccessToken({ userId: id, role }),
  };
}

async function createTestCategory() {
  const name = `Referral Category ${randomUUID()}`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_categories (name) VALUES ($1) RETURNING id`,
    [name],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test category.");

  testCategoryIds.push(id);
  return id;
}

async function createTestLocation() {
  const name = `Referral Location ${randomUUID()}`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_locations (name) VALUES ($1) RETURNING id`,
    [name],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test location.");

  testLocationIds.push(id);
  return id;
}

async function createTestProperty(
  ownerId: string,
  categoryId: string,
  locationId: string,
  title: string,
) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO properties (
       owner_id, title, property_type, location,
       category_id, location_id, size_sqm, bedrooms,
       bathrooms, features, price, status
     )
     VALUES (
       $1, $2, 'Residential', 'Test City',
       $3, $4, 120, 3, 2, ARRAY['parking'], 2500000, 'active'
     )
     RETURNING id`,
    [ownerId, title, categoryId, locationId],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test property.");

  testPropertyIds.push(id);
  return id;
}

async function createTestReferral(input: {
  buyerId: string;
  propertyId: string;
  assignedTo: string;
  message: string;
  status: string;
  createdAt: string;
}) {
  const result = await pool.query<{ id: string; reference_code: string }>(
    `INSERT INTO referrals (
       buyer_id, property_id, assigned_to, message, status,
       created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::referral_status, $6, $6)
     RETURNING id, reference_code`,
    [
      input.buyerId,
      input.propertyId,
      input.assignedTo,
      input.message,
      input.status,
      input.createdAt,
    ],
  );

  const referral = result.rows[0];
  if (!referral) throw new Error("Could not create test referral.");

  testReferralIds.push(referral.id);
  return referral;
}

async function cleanupTestData() {
  if (testReferralIds.length) {
    await pool.query(
      `DELETE FROM referral_messages WHERE referral_id = ANY($1::uuid[])`,
      [testReferralIds],
    );

    await pool.query(
      `DELETE FROM referral_events WHERE referral_id = ANY($1::uuid[])`,
      [testReferralIds],
    );

    await pool.query(
      `DELETE FROM referrals WHERE id = ANY($1::uuid[])`,
      [testReferralIds],
    );
  }

  if (testPropertyIds.length) {
    await pool.query(
      `DELETE FROM properties WHERE id = ANY($1::uuid[])`,
      [testPropertyIds],
    );
  }

  if (testCategoryIds.length) {
    await pool.query(
      `DELETE FROM property_categories WHERE id = ANY($1::uuid[])`,
      [testCategoryIds],
    );
  }

  if (testLocationIds.length) {
    await pool.query(
      `DELETE FROM property_locations WHERE id = ANY($1::uuid[])`,
      [testLocationIds],
    );
  }

  if (testUserIds.length) {
    await pool.query(
      `DELETE FROM users WHERE id = ANY($1::uuid[])`,
      [testUserIds],
    );
  }

  testReferralIds.length = 0;
  testPropertyIds.length = 0;
  testCategoryIds.length = 0;
  testLocationIds.length = 0;
  testUserIds.length = 0;
}

beforeAll(() => {
  const databaseUrl = process.env.DATABASE_URL;
  const expectedHost = process.env.TEST_DATABASE_HOST;

  if (!databaseUrl || !expectedHost) {
    throw new Error("Test database environment variables are missing.");
  }

  const actualHost = new URL(databaseUrl).hostname;

  if (actualHost !== expectedHost) {
    throw new Error(
      `Unsafe test database: expected ${expectedHost}, got ${actualHost}`,
    );
  }
});

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await pool.end();
});

describe("Admin referral list and CSV export", () => {
  it("lists referrals with filters and pagination", async () => {
    const admin = await createTestUser("admin", "Referral Admin");
    const agent = await createTestUser("agent", "Referral Agent");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();

    const referrals = [];

    for (const [index, status] of [
      "assigned",
      "accepted",
      "closed_won",
    ].entries()) {
      const buyer = await createTestUser(
        "buyer",
        `Referral Buyer ${index}`,
      );

      const propertyId = await createTestProperty(
        agent.id,
        categoryId,
        locationId,
        `Referral Property ${index}`,
      );

      referrals.push(
        await createTestReferral({
          buyerId: buyer.id,
          propertyId,
          assignedTo: agent.id,
          message: `Test inquiry ${index}`,
          status,
          createdAt: `2026-10-${String(10 + index).padStart(2, "0")}T10:00:00Z`,
        }),
      );
    }

    const response = await request(app)
      .get("/api/v1/referrals/admin")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ page: 1, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.total).toBeGreaterThanOrEqual(3);

    const filtered = await request(app)
      .get("/api/v1/referrals/admin")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({
        status: "accepted",
        q: "Referral Property 1",
        page: 1,
        limit: 10,
      });

    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].status).toBe("accepted");
  });

  it("exports all matching referrals as CSV without pagination", async () => {
    const admin = await createTestUser("admin", "Referral Admin");
    const agent = await createTestUser("agent", "Referral Agent");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();

    for (const [index, status] of [
      "assigned",
      "accepted",
      "closed_won",
    ].entries()) {
      const buyer = await createTestUser(
        "buyer",
        `CSV Buyer ${index}`,
      );

      const propertyId = await createTestProperty(
        agent.id,
        categoryId,
        locationId,
        `CSV Property ${index}`,
      );

      await createTestReferral({
        buyerId: buyer.id,
        propertyId,
        assignedTo: agent.id,
        message: `CSV inquiry ${index}`,
        status,
        createdAt: `2026-10-${String(10 + index).padStart(2, "0")}T10:00:00Z`,
      });
    }

    const response = await request(app)
      .get("/api/v1/referrals/admin/export")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ status: "assigned", page: 1, limit: 1 });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      "sola-referrals.csv",
    );
    expect(response.headers["cache-control"]).toBe("no-store");

    expect(response.text).toContain("Reference Code");
    expect(response.text).toContain("Buyer Name");
    expect(response.text).toContain("Property Title");
    expect(response.text).toContain("CSV Property 0");

    // Export must not apply list pagination.
    const allResponse = await request(app)
      .get("/api/v1/referrals/admin/export")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ page: 1, limit: 1 });

    expect(allResponse.status).toBe(200);
    expect(allResponse.text).toContain("CSV Property 0");
    expect(allResponse.text).toContain("CSV Property 1");
    expect(allResponse.text).toContain("CSV Property 2");

    // Private messages and event history are not part of this export.
    expect(allResponse.text).not.toContain("referral_messages");
    expect(allResponse.text).not.toContain("password_hash");
  });

  it("returns a header-only CSV when no referrals match", async () => {
    const admin = await createTestUser("admin", "Referral Admin");

    const response = await request(app)
      .get("/api/v1/referrals/admin/export")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ status: "rejected" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("Reference Code");
    expect(response.text).not.toContain("REF-");
  });

  it("rejects unauthenticated and non-admin requests", async () => {
    const buyer = await createTestUser("buyer", "Referral Buyer");

    const unauthenticated = await request(app)
      .get("/api/v1/referrals/admin/export");

    expect(unauthenticated.status).toBe(401);

    const forbidden = await request(app)
      .get("/api/v1/referrals/admin/export")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(forbidden.status).toBe(403);
  });

  it("rejects invalid filters", async () => {
    const admin = await createTestUser("admin", "Referral Admin");

    const invalidStatus = await request(app)
      .get("/api/v1/referrals/admin/export")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ status: "not-a-status" });

    expect(invalidStatus.status).toBe(400);

    const invalidDateRange = await request(app)
      .get("/api/v1/referrals/admin/export")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({
        dateFrom: "2026-10-20",
        dateTo: "2026-10-10",
      });

    expect(invalidDateRange.status).toBe(400);
  });
});
