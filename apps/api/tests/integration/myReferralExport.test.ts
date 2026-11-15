
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

type TestRole = Extract<AppRole, "buyer" | "agent" | "developer">;

async function createTestUser(role: TestRole, fullName: string) {
  const email = `my-referral-export-${randomUUID()}@example.test`;

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
    `INSERT INTO property_categories (name)
     VALUES ($1)
     RETURNING id`,
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
    `INSERT INTO property_locations (name)
     VALUES ($1)
     RETURNING id`,
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
  assigneeId: string;
  message: string;
}) {
  const result = await pool.query<{ id: string; reference_code: string }>(
    `INSERT INTO referrals (
       buyer_id, property_id, assigned_to, message
     )
     VALUES ($1, $2, $3, $4)
     RETURNING id, reference_code`,
    [
      input.buyerId,
      input.propertyId,
      input.assigneeId,
      input.message,
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
      `DELETE FROM referral_messages
       WHERE referral_id = ANY($1::uuid[])`,
      [testReferralIds],
    );

    await pool.query(
      `DELETE FROM referral_events
       WHERE referral_id = ANY($1::uuid[])`,
      [testReferralIds],
    );

    await pool.query(
      `DELETE FROM referrals
       WHERE id = ANY($1::uuid[])`,
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

describe("My referral CSV export", () => {
  it.each(["agent", "developer"] as const)(
    "allows a %s to export only referrals assigned to them",
    async (role) => {
      const assignee = await createTestUser(
        role,
        `Test ${role}`,
      );

      const otherAgent = await createTestUser(
        "agent",
        "Other Agent",
      );

      const categoryId = await createTestCategory();
      const locationId = await createTestLocation();

      const ownBuyer = await createTestUser(
        "buyer",
        "Own Referral Buyer",
      );

      const otherBuyer = await createTestUser(
        "buyer",
        "Other Referral Buyer",
      );

      const ownPropertyId = await createTestProperty(
        assignee.id,
        categoryId,
        locationId,
        `Own Referral Property ${randomUUID()}`,
      );

      const otherPropertyId = await createTestProperty(
        otherAgent.id,
        categoryId,
        locationId,
        `Other Referral Property ${randomUUID()}`,
      );

      const ownReferral = await createTestReferral({
        buyerId: ownBuyer.id,
        propertyId: ownPropertyId,
        assigneeId: assignee.id,
        message: "My assigned referral",
      });

      const otherReferral = await createTestReferral({
        buyerId: otherBuyer.id,
        propertyId: otherPropertyId,
        assigneeId: otherAgent.id,
        message: "Another agent's private referral",
      });

      const response = await request(app)
        .get("/api/v1/referrals/me/export")
        .set("Authorization", `Bearer ${assignee.token}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain(
        "sola-my-referrals.csv",
      );
      expect(response.headers["cache-control"]).toBe("no-store");

      expect(response.text).toContain("Reference Code");
      expect(response.text).toContain(ownReferral.reference_code);
      expect(response.text).toContain("Own Referral Buyer");
      expect(response.text).toContain("My assigned referral");

      expect(response.text).not.toContain(otherReferral.reference_code);
      expect(response.text).not.toContain("Other Referral Buyer");
      expect(response.text).not.toContain(
        "Another agent's private referral",
      );
    },
  );

  it("returns a header-only CSV when the assignee has no referrals", async () => {
    const agent = await createTestUser("agent", "Empty Agent");

    const response = await request(app)
      .get("/api/v1/referrals/me/export")
      .set("Authorization", `Bearer ${agent.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("Reference Code");
    expect(response.text).not.toContain("REF-");
  });

  it("rejects unauthenticated and buyer requests", async () => {
    const buyer = await createTestUser("buyer", "Test Buyer");

    const unauthenticated = await request(app)
      .get("/api/v1/referrals/me/export");

    expect(unauthenticated.status).toBe(401);

    const forbidden = await request(app)
      .get("/api/v1/referrals/me/export")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(forbidden.status).toBe(403);
  });
});
