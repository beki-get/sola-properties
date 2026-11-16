import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/emailService", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
import request from "supertest";

import type { AppRole } from "../../src/queries/authQueries";
import { pool } from "../../src/config/database";
import app from "../../src/app";
import { signAccessToken } from "../../src/utils/jwt";

const API = "/api/v1/transactions";

const testUserIds: string[] = [];
const testPropertyIds: string[] = [];
const testCategoryIds: string[] = [];
const testLocationIds: string[] = [];
const testReferralIds: string[] = [];
const testTransactionIds: string[] = [];

type TestRole = Extract<
  AppRole,
  "admin" | "finance_admin" | "buyer" | "agent" | "developer"
>;

async function createTestUser(role: TestRole, fullName: string) {
  const email = `transaction-export-${randomUUID()}@example.test`;

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
  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_categories (name)
     VALUES ($1)
     RETURNING id`,
    [`Transaction Category ${randomUUID()}`],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test category.");

  testCategoryIds.push(id);
  return id;
}

async function createTestLocation() {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_locations (name)
     VALUES ($1)
     RETURNING id`,
    [`Transaction Location ${randomUUID()}`],
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
}) {
  const result = await pool.query<{ id: string; reference_code: string }>(
    `INSERT INTO referrals (
       buyer_id, property_id, assigned_to, message, status
     )
     VALUES ($1, $2, $3, $4, 'closed_won')
     RETURNING id, reference_code`,
    [
      input.buyerId,
      input.propertyId,
      input.assignedTo,
      "Transaction export integration test",
    ],
  );

  const referral = result.rows[0];
  if (!referral) throw new Error("Could not create test referral.");

  testReferralIds.push(referral.id);
  return referral;
}

async function createTestTransaction(input: {
  buyerId: string;
  sellerId: string;
  propertyId: string;
  referralId: string;
  saleAmount: number;
  closingDate: string;
  status: "submitted" | "verified" | "rejected";
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
       referral_id,
       buyer_id,
       property_id,
       seller_id,
       sale_amount,
       closing_date,
       status,
       notes,
       rejection_reason,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7::transaction_status,
       $8, $9, $10, $10
     )
     RETURNING id`,
    [
      input.referralId,
      input.buyerId,
      input.propertyId,
      input.sellerId,
      input.saleAmount,
      input.closingDate,
      input.status,
      input.notes ?? null,
      input.rejectionReason ?? null,
      input.createdAt,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test transaction.");

  testTransactionIds.push(id);
  return id;
}

async function cleanupTestData() {
  if (testTransactionIds.length) {
    await pool.query(
      `DELETE FROM transaction_documents
       WHERE transaction_id = ANY($1::uuid[])`,
      [testTransactionIds],
    );

    await pool.query(
      `DELETE FROM transactions
       WHERE id = ANY($1::uuid[])`,
      [testTransactionIds],
    );
  }

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
      `DELETE FROM properties
       WHERE id = ANY($1::uuid[])`,
      [testPropertyIds],
    );
  }

  if (testCategoryIds.length) {
    await pool.query(
      `DELETE FROM property_categories
       WHERE id = ANY($1::uuid[])`,
      [testCategoryIds],
    );
  }

  if (testLocationIds.length) {
    await pool.query(
      `DELETE FROM property_locations
       WHERE id = ANY($1::uuid[])`,
      [testLocationIds],
    );
  }

  if (testUserIds.length) {
    await pool.query(
      `DELETE FROM users
       WHERE id = ANY($1::uuid[])`,
      [testUserIds],
    );
  }

  testTransactionIds.length = 0;
  testReferralIds.length = 0;
  testPropertyIds.length = 0;
  testCategoryIds.length = 0;
  testLocationIds.length = 0;
  testUserIds.length = 0;
}

function exportRequest(token: string) {
  return request(app)
    .get(`${API}/export`)
    .set("Authorization", `Bearer ${token}`);
}

let admin: Awaited<ReturnType<typeof createTestUser>>;
let financeAdmin: Awaited<ReturnType<typeof createTestUser>>;
let buyer: Awaited<ReturnType<typeof createTestUser>>;
let agent: Awaited<ReturnType<typeof createTestUser>>;
let anotherAgent: Awaited<ReturnType<typeof createTestUser>>;
let developer: Awaited<ReturnType<typeof createTestUser>>;

let agentTransactionId: string;
let anotherAgentTransactionId: string;
let developerTransactionId: string;
let agentReferralReference: string;

beforeAll(async () => {
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

  admin = await createTestUser("admin", "Transaction Admin");
  financeAdmin = await createTestUser(
    "finance_admin",
    "Transaction Finance Admin",
  );
  buyer = await createTestUser("buyer", "Transaction Buyer");
  agent = await createTestUser("agent", "Transaction Agent");
  anotherAgent = await createTestUser("agent", "Another Transaction Agent");
  developer = await createTestUser("developer", "Transaction Developer");

  const categoryId = await createTestCategory();
  const locationId = await createTestLocation();

  const agentPropertyId = await createTestProperty(
    agent.id,
    categoryId,
    locationId,
    `Agent Transaction Property ${randomUUID()}`,
  );

  const anotherAgentPropertyId = await createTestProperty(
    anotherAgent.id,
    categoryId,
    locationId,
    `Another Agent Transaction Property ${randomUUID()}`,
  );

  const developerPropertyId = await createTestProperty(
    developer.id,
    categoryId,
    locationId,
    `Developer Transaction Property ${randomUUID()}`,
  );

  const agentReferral = await createTestReferral({
    buyerId: buyer.id,
    propertyId: agentPropertyId,
    assignedTo: agent.id,
  });

  const anotherAgentReferral = await createTestReferral({
    buyerId: buyer.id,
    propertyId: anotherAgentPropertyId,
    assignedTo: anotherAgent.id,
  });

  const developerReferral = await createTestReferral({
    buyerId: buyer.id,
    propertyId: developerPropertyId,
    assignedTo: developer.id,
  });

  agentReferralReference = agentReferral.reference_code;

  agentTransactionId = await createTestTransaction({
    buyerId: buyer.id,
    sellerId: agent.id,
    propertyId: agentPropertyId,
    referralId: agentReferral.id,
    saleAmount: 2500000,
    closingDate: "2026-01-15",
    status: "rejected",
    notes: "Agent private transaction notes",
    rejectionReason: "Missing supporting document",
    createdAt: "2026-01-15T10:00:00Z",
  });

  anotherAgentTransactionId = await createTestTransaction({
    buyerId: buyer.id,
    sellerId: anotherAgent.id,
    propertyId: anotherAgentPropertyId,
    referralId: anotherAgentReferral.id,
    saleAmount: 3500000,
    closingDate: "2026-02-15",
    status: "verified",
    notes: "Another agent transaction notes",
    createdAt: "2026-02-15T10:00:00Z",
  });

  developerTransactionId = await createTestTransaction({
    buyerId: buyer.id,
    sellerId: developer.id,
    propertyId: developerPropertyId,
    referralId: developerReferral.id,
    saleAmount: 4500000,
    closingDate: "2026-03-15",
    status: "submitted",
    notes: "Developer transaction notes",
    createdAt: "2026-03-15T10:00:00Z",
  });
});

afterAll(async () => {
  try {
    await cleanupTestData();
  } finally {
    await pool.end();
  }
});
describe("GET /api/v1/transactions/export", () => {
  it("allows Admin to export all transactions with operational and financial fields", async () => {
    const response = await exportRequest(admin.token);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      "sola-transactions.csv",
    );
    expect(response.headers["cache-control"]).toBe("no-store");

    expect(response.text).toContain(agentTransactionId);
    expect(response.text).toContain(anotherAgentTransactionId);
    expect(response.text).toContain(developerTransactionId);

    expect(response.text).toContain("Sale Amount");
    expect(response.text).toContain("Rejection Reason");
    expect(response.text).not.toContain("Notes");
    expect(response.text).not.toContain("Agent private transaction notes");
  });

  it("allows Finance Admin to export all transactions including notes", async () => {
    const response = await exportRequest(financeAdmin.token);

    expect(response.status).toBe(200);

    expect(response.text).toContain(agentTransactionId);
    expect(response.text).toContain(anotherAgentTransactionId);
    expect(response.text).toContain(developerTransactionId);

    expect(response.text).toContain("Sale Amount");
    expect(response.text).toContain("Rejection Reason");
    expect(response.text).toContain("Notes");
    expect(response.text).toContain("Agent private transaction notes");
    expect(response.text).toContain("Another agent transaction notes");
  });

  it("allows agents to export only their own transactions", async () => {
    const response = await exportRequest(agent.token);

    expect(response.status).toBe(200);
    expect(response.text).toContain(agentTransactionId);

    expect(response.text).not.toContain(anotherAgentTransactionId);
    expect(response.text).not.toContain(developerTransactionId);
  });

  it("allows developers to export only their own transactions", async () => {
    const response = await exportRequest(developer.token);

    expect(response.status).toBe(200);
    expect(response.text).toContain(developerTransactionId);

    expect(response.text).not.toContain(agentTransactionId);
    expect(response.text).not.toContain(anotherAgentTransactionId);
  });

  it("does not allow buyers to export transactions", async () => {
    const response = await exportRequest(buyer.token);

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated export requests", async () => {
    const response = await request(app).get(`${API}/export`);

    expect(response.status).toBe(401);
  });

  it("filters transactions by status", async () => {
    const response = await exportRequest(admin.token).query({
      status: "rejected",
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain(agentTransactionId);

    expect(response.text).not.toContain(anotherAgentTransactionId);
    expect(response.text).not.toContain(developerTransactionId);
  });

  it("filters transactions by creation date range", async () => {
    const response = await exportRequest(admin.token).query({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain(anotherAgentTransactionId);

    expect(response.text).not.toContain(agentTransactionId);
    expect(response.text).not.toContain(developerTransactionId);
  });

  it("filters transactions by referral reference", async () => {
    const response = await exportRequest(admin.token).query({
      q: agentReferralReference,
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain(agentTransactionId);

    expect(response.text).not.toContain(anotherAgentTransactionId);
    expect(response.text).not.toContain(developerTransactionId);
  });

  it("combines status, date range, and search filters", async () => {
    const response = await exportRequest(admin.token).query({
      status: "rejected",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      q: agentReferralReference,
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain(agentTransactionId);

    expect(response.text).not.toContain(anotherAgentTransactionId);
    expect(response.text).not.toContain(developerTransactionId);
  });

  it("applies filters within the agent's own transaction scope", async () => {
    const response = await exportRequest(agent.token).query({
      status: "rejected",
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain(agentTransactionId);

    expect(response.text).not.toContain(anotherAgentTransactionId);
    expect(response.text).not.toContain(developerTransactionId);
  });

  it("returns CSV headers when no transactions match", async () => {
    const response = await exportRequest(admin.token).query({
      status: "rejected",
      dateFrom: "2020-01-01",
      dateTo: "2020-01-02",
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Transaction ID");
    expect(response.text).toContain("Sale Amount");
    expect(response.text).not.toContain(agentTransactionId);
  });

  it("rejects invalid status filters", async () => {
    const response = await exportRequest(admin.token).query({
      status: "cancelled",
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_TRANSACTION_QUERY");
  });

  it("rejects invalid date ranges", async () => {
    const response = await exportRequest(admin.token).query({
      dateFrom: "2026-03-01",
      dateTo: "2026-01-01",
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_TRANSACTION_QUERY");
  });

  it("rejects invalid date values", async () => {
    const response = await exportRequest(admin.token).query({
      dateFrom: "not-a-date",
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_TRANSACTION_QUERY");
  });
});
