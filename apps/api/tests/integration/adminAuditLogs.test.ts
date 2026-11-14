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

type TestRole = Extract<AppRole, "admin" | "finance_admin" | "buyer">;

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

async function createTestUser(role: TestRole) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, 'approved', NOW())
     RETURNING id`,
    [
      "Audit Log Test User",
      `audit-log-${randomUUID()}@example.test`,
      "test-only-hash",
      role,
    ],
  );

  const id = result.rows[0]?.id;

  if (!id) throw new Error("Could not create audit-log test user.");

  testUserIds.push(id);

  return {
    id,
    token: await signAccessToken({ userId: id, role }),
  };
}

async function insertAuditLog(
  actorId: string,
  options: {
    action?: string;
    entityType?: string;
    entityId?: string;
  } = {},
) {
  const entityId = options.entityId ?? randomUUID();

  const result = await pool.query<{ id: string }>(
    `INSERT INTO audit_logs (
       actor_id,
       action,
       entity_type,
       entity_id,
       old_values,
       new_values
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      actorId,
      options.action ?? "property.updated",
      options.entityType ?? "property",
      entityId,
      JSON.stringify({ status: "draft" }),
      JSON.stringify({ status: "active" }),
    ],
  );

  return { id: result.rows[0].id, entityId };
}

afterEach(async () => {
  const userIds = [...testUserIds];

  if (userIds.length === 0) return;

  await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [
    userIds,
  ]);

  await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);

  testUserIds.splice(0, userIds.length);
});

afterAll(async () => {
  await pool.end();
});

describe("admin audit log routes", () => {
  it("returns paginated audit logs newest first", async () => {
    const admin = await createTestUser("admin");

    await insertAuditLog(admin.id, { action: "property.created" });
    await insertAuditLog(admin.id, { action: "property.updated" });

    const response = await request(app)
      .get(`/api/v1/admin/audit-logs?actor_id=${admin.id}&page=1&limit=10`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(2);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });

    expect(
      new Date(response.body.logs[0].created_at).getTime(),
    ).toBeGreaterThanOrEqual(
      new Date(response.body.logs[1].created_at).getTime(),
    );
  });

  it("filters audit logs by actor, action, entity and date range", async () => {
    const admin = await createTestUser("admin");
    const otherAdmin = await createTestUser("admin");

    const matching = await insertAuditLog(admin.id, {
      action: "property.updated",
      entityType: "property",
    });

    await insertAuditLog(otherAdmin.id, {
      action: "property.created",
      entityType: "property",
    });

    const timestampResult = await pool.query<{ created_at: Date }>(
      "SELECT created_at FROM audit_logs WHERE id = $1",
      [matching.id],
    );

    const createdAt = new Date(timestampResult.rows[0].created_at);
    const startDate = new Date(createdAt.getTime() - 60_000).toISOString();
    const endDate = new Date(createdAt.getTime() + 60_000).toISOString();

    const response = await request(app)
      .get(
        `/api/v1/admin/audit-logs?actor_id=${admin.id}` +
          `&action=property.updated&entity_type=property` +
          `&entity_id=${matching.entityId}` +
          `&start_date=${encodeURIComponent(startDate)}` +
          `&end_date=${encodeURIComponent(endDate)}`,
      )
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(1);
    expect(response.body.logs[0].id).toBe(matching.id);
  });

  it("rejects invalid filters and pagination", async () => {
    const admin = await createTestUser("admin");

    const invalidPage = await request(app)
      .get("/api/v1/admin/audit-logs?page=0")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(invalidPage.status).toBe(400);

    const invalidActor = await request(app)
      .get("/api/v1/admin/audit-logs?actor_id=invalid")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(invalidActor.status).toBe(400);

    const invalidDateRange = await request(app)
      .get(
        "/api/v1/admin/audit-logs" +
          "?start_date=2026-02-02T00%3A00%3A00Z" +
          "&end_date=2026-02-01T00%3A00%3A00Z",
      )
      .set("Authorization", `Bearer ${admin.token}`);

    expect(invalidDateRange.status).toBe(400);
  });

  it("restricts access to admins only", async () => {
    const buyer = await createTestUser("buyer");
    const financeAdmin = await createTestUser("finance_admin");

    const unauthenticated = await request(app).get("/api/v1/admin/audit-logs");
    expect(unauthenticated.status).toBe(401);

    const buyerResponse = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(buyerResponse.status).toBe(403);
    expect(buyerResponse.body.code).toBe("ROLE_NOT_ALLOWED");

    const financeResponse = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${financeAdmin.token}`);

    expect(financeResponse.status).toBe(403);
    expect(financeResponse.body.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("does not expose mutation endpoints", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .delete("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(404);
  });

  it("returns an empty result when the actor has no audit logs", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get(`/api/v1/admin/audit-logs?actor_id=${admin.id}&page=1&limit=10`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(0);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 0,
    });
  });

  it("returns audit logs from different actors when no actor filter is supplied", async () => {
    const admin = await createTestUser("admin");
    const otherAdmin = await createTestUser("admin");

    const firstLog = await insertAuditLog(admin.id);
    const secondLog = await insertAuditLog(otherAdmin.id);

    const response = await request(app)
      .get("/api/v1/admin/audit-logs?page=1&limit=10")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);

    const returnedIds = response.body.logs.map((log: { id: string }) => log.id);

    expect(returnedIds).toContain(firstLog.id);
    expect(returnedIds).toContain(secondLog.id);
  });

  it("rejects requests with an invalid access token", async () => {
    const response = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", "Bearer invalid-access-token");

    expect(response.status).toBe(401);
  });

  it("returns an empty result when requesting a page beyond the available records", async () => {
    const admin = await createTestUser("admin");

    await insertAuditLog(admin.id);
    await insertAuditLog(admin.id);

    const response = await request(app)
      .get(`/api/v1/admin/audit-logs?actor_id=${admin.id}&page=2&limit=2`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(0);
    expect(response.body.pagination).toMatchObject({
      page: 2,
      limit: 2,
      total: 2,
      totalPages: 1,
    });
  });
});
