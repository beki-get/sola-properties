
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

type TestRole = Extract<
  AppRole,
  "admin" | "finance_admin" | "buyer" | "agent" | "developer"
>;

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

async function createTestUser(
  role: TestRole,
  options: {
    fullName?: string;
    email?: string;
    status?: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
    emailVerified?: boolean;
  } = {},
) {
  const email = options.email ?? `user-export-${randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, $5::account_status, $6)
     RETURNING id`,
    [
      options.fullName ?? "User Export Test",
      email,
      "test-only-password-hash",
      role,
      options.status ?? "approved",
      options.emailVerified === false ? null : new Date(),
    ],
  );

  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error("Could not create user-export test user.");
  }

  testUserIds.push(id);

  return {
    id,
    email,
    token: await signAccessToken({ userId: id, role }),
  };
}

async function insertBuyerProfile(userId: string, phoneNumber: string) {
  await pool.query(
    `INSERT INTO buyer_profiles (user_id, phone_number)
     VALUES ($1, $2)`,
    [userId, phoneNumber],
  );
}

afterEach(async () => {
  const userIds = [...testUserIds];

  if (userIds.length === 0) return;

  // Delete dependent records first if your test schema has
  // foreign keys without ON DELETE CASCADE.
  await pool.query(
    "DELETE FROM buyer_profiles WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );

  await pool.query(
    "DELETE FROM agent_profiles WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );

  await pool.query(
    "DELETE FROM developer_profiles WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );

  await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);

  testUserIds.splice(0, userIds.length);
});

afterAll(async () => {
  await pool.end();
});

describe("admin user CSV export", () => {
  it("allows admins to download users as CSV", async () => {
    const admin = await createTestUser("admin");

    const buyer = await createTestUser("buyer", {
      fullName: "Export Test Buyer",
    });

    const response = await request(app)
      .get("/api/v1/admin/users/export")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      'filename="sola-users.csv"',
    );

    expect(response.text).toContain("User ID");
    expect(response.text).toContain("Full Name");
    expect(response.text).toContain("Email");
    expect(response.text).toContain(buyer.email);
    expect(response.text).toContain("Export Test Buyer");
  });

  it("rejects non-admin users", async () => {
    const buyer = await createTestUser("buyer");

    const response = await request(app)
      .get("/api/v1/admin/users/export")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get(
      "/api/v1/admin/users/export",
    );

    expect(response.status).toBe(401);
  });

  it("applies role and status filters", async () => {
    const admin = await createTestUser("admin");

    const matchingBuyer = await createTestUser("buyer", {
      fullName: "Matching Buyer",
    });

    const otherAgent = await createTestUser("agent", {
      fullName: "Different Agent",
    });

    const response = await request(app)
      .get("/api/v1/admin/users/export?role=buyer&status=approved")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(matchingBuyer.email);
    expect(response.text).not.toContain(otherAgent.email);
  });

  it("applies search and email verification filters", async () => {
    const admin = await createTestUser("admin");

    const verifiedBuyer = await createTestUser("buyer", {
      fullName: "Verified Search Match",
      emailVerified: true,
    });

    const unverifiedBuyer = await createTestUser("buyer", {
      fullName: "Verified Search Match Unverified",
      emailVerified: false,
    });

    const response = await request(app)
      .get(
        "/api/v1/admin/users/export?q=Verified%20Search%20Match&emailVerified=true",
      )
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(verifiedBuyer.email);
    expect(response.text).not.toContain(unverifiedBuyer.email);
  });

  it("exports phone numbers from buyer profiles", async () => {
    const admin = await createTestUser("admin");
    const buyer = await createTestUser("buyer");

    await insertBuyerProfile(buyer.id, "+251911123456");

    const response = await request(app)
      .get("/api/v1/admin/users/export")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("+251911123456");
  });

  it("does not export password hashes or authentication secrets", async () => {
    const admin = await createTestUser("admin");
    await createTestUser("buyer");

    const response = await request(app)
      .get("/api/v1/admin/users/export")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("test-only-password-hash");
    expect(response.text).not.toContain("password_hash");
    expect(response.text).not.toContain("refresh_tokens");
    expect(response.text).not.toContain("password_reset");
  });

  it("rejects invalid filter values", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get("/api/v1/admin/users/export?role=invalid")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid date range", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get(
        "/api/v1/admin/users/export?dateFrom=2026-05-20&dateTo=2026-05-10",
      )
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns only matching users within the registration date range", async () => {
    const admin = await createTestUser("admin");

    const matchingUser = await createTestUser("buyer");

    const response = await request(app)
      .get(
        "/api/v1/admin/users/export?dateFrom=2020-01-01&dateTo=2030-01-01",
      )
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(matchingUser.email);
  });

  it("returns a valid CSV header when no users match the filters", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get("/api/v1/admin/users/export?q=no-user-with-this-name")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("User ID");
    expect(response.text).not.toContain("User Export Test");
  });
});
