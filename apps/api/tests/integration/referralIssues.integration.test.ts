import { vi } from "vitest";
process.env.JWT_ACCESS_SECRET =
  "test-access-secret-for-sola-properties-at-least-32-chars";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

vi.mock("../../src/services/emailService", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
import app from "../../src/app";
import { pool } from "../../src/config/database";
import { login } from "../../src/services/authService";

const TEST_PASSWORD = "Correct-Password-123!";
const TEST_PREFIX = `referral-issues-test-${randomUUID()}`;
const DB_HOOK_TIMEOUT_MS = 30_000;

const testEmails: string[] = [];
const userIds: string[] = [];
const propertyIds: string[] = [];
const referralIds: string[] = [];

type TestRole = "buyer" | "agent" | "developer" | "admin";

type TestUser = {
  id: string;
  email: string;
  accessToken: string;
  role: TestRole;
};

type TestReferral = {
  id: string;
};

function newTestEmail(): string {
  const email = `${TEST_PREFIX}-${randomUUID()}@example.test`;
  testEmails.push(email);
  return email;
}

async function createUser(role: TestRole): Promise<TestUser> {
  const email = newTestEmail();
  const passwordHash = await argon2.hash(TEST_PASSWORD);

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4, 'approved', NOW())
     RETURNING id`,
    [`Referral Issue Test ${role}`, email, passwordHash, role],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("Test user could not be created.");
  }

  userIds.push(user.id);

  if (role === "buyer") {
    await pool.query(
      `INSERT INTO buyer_profiles (user_id, phone_number)
       VALUES ($1, $2)`,
      [user.id, "0911000001"],
    );
  }

  if (role === "agent") {
    await pool.query(
      `INSERT INTO agent_profiles (user_id, phone_number)
       VALUES ($1, $2)`,
      [user.id, "0911000002"],
    );
  }

  if (role === "developer") {
    await pool.query(
      `INSERT INTO developer_profiles (
         user_id,
         company_name,
         contact_phone,
         business_address
       )
       VALUES ($1, $2, $3, $4)`,
      [user.id, "Test Developer Company", "0911000003", "Test Address"],
    );
  }

  const session = await login({
    email,
    password: TEST_PASSWORD,
  });

  return {
    id: user.id,
    email,
    accessToken: session.accessToken,
    role,
  };
}

async function createProperty(ownerId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO properties (
       owner_id,
       title,
       description,
       property_type,
       location,
       price,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING id`,
    [
      ownerId,
      `Test Property ${randomUUID()}`,
      "Property created for integration testing",
      "apartment",
      "Bahir Dar",
      1500000,
    ],
  );

  const property = result.rows[0];

  if (!property) {
    throw new Error("Test property could not be created.");
  }

  propertyIds.push(property.id);

  return property.id;
}

async function createReferral(input: {
  buyerId: string;
  propertyId: string;
  assignedTo: string;
}): Promise<TestReferral> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO referrals (
       buyer_id,
       property_id,
       assigned_to
     )
     VALUES ($1, $2, $3)
     RETURNING id`,
    [input.buyerId, input.propertyId, input.assignedTo],
  );

  const referral = result.rows[0];

  if (!referral) {
    throw new Error("Test referral could not be created.");
  }

  referralIds.push(referral.id);

  return referral;
}

async function createIssue(token: string, referralId: string) {
  return request(app)
    .post("/api/v1/referral-issues")
    .set("Authorization", `Bearer ${token}`)
    .send({
      referralId,
      category: "communication",
      subject: "Unable to contact seller",
      description: "I have tried contacting the seller several times.",
    });
}

let buyer: TestUser;
let anotherBuyer: TestUser;
let assignedSeller: TestUser;
let unassignedSeller: TestUser;
let admin: TestUser;

let propertyId: string;
let buyerReferral: TestReferral;
let anotherBuyerReferral: TestReferral;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_issues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE RESTRICT,
      reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      category TEXT NOT NULL CHECK (
        category IN (
          'communication',
          'property_information',
          'seller_behavior',
          'buyer_behavior',
          'payment',
          'visit_or_scheduling',
          'fraud_or_suspicious_activity',
          'other'
        )
      ),
      subject VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (
        status IN ('open', 'under_review', 'resolved', 'dismissed')
      ),
      admin_notes TEXT,
      resolution TEXT,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT referral_issues_subject_not_blank
        CHECK (LENGTH(BTRIM(subject)) > 0),
      CONSTRAINT referral_issues_description_not_blank
        CHECK (LENGTH(BTRIM(description)) > 0),
      CONSTRAINT referral_issues_admin_notes_not_blank
        CHECK (admin_notes IS NULL OR LENGTH(BTRIM(admin_notes)) > 0),
      CONSTRAINT referral_issues_resolution_not_blank
        CHECK (resolution IS NULL OR LENGTH(BTRIM(resolution)) > 0)
    );

    CREATE INDEX IF NOT EXISTS referral_issues_referral_idx
      ON referral_issues (referral_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS referral_issues_reporter_idx
      ON referral_issues (reported_by, created_at DESC);

    CREATE INDEX IF NOT EXISTS referral_issues_status_idx
      ON referral_issues (status, created_at DESC);
  `);
}, DB_HOOK_TIMEOUT_MS);

beforeEach(async () => {
  buyer = await createUser("buyer");
  anotherBuyer = await createUser("buyer");
  assignedSeller = await createUser("agent");
  unassignedSeller = await createUser("agent");
  admin = await createUser("admin");

  propertyId = await createProperty(assignedSeller.id);

  buyerReferral = await createReferral({
    buyerId: buyer.id,
    propertyId,
    assignedTo: assignedSeller.id,
  });

  anotherBuyerReferral = await createReferral({
    buyerId: anotherBuyer.id,
    propertyId,
    assignedTo: assignedSeller.id,
  });
}, DB_HOOK_TIMEOUT_MS);

afterEach(async () => {
  const referralIdsToCleanup = [...new Set(referralIds)];
  const propertyIdsToCleanup = [...new Set(propertyIds)];
  const userIdsToCleanup = [...new Set(userIds)];

  if (referralIdsToCleanup.length > 0) {
    await pool.query(
      `DELETE FROM referral_issues
       WHERE referral_id = ANY($1::uuid[])`,
      [referralIdsToCleanup],
    );

    await pool.query(
      `DELETE FROM referrals
       WHERE id = ANY($1::uuid[])`,
      [referralIdsToCleanup],
    );
  }

  if (propertyIdsToCleanup.length > 0) {
    await pool.query(
      `DELETE FROM properties
       WHERE id = ANY($1::uuid[])`,
      [propertyIdsToCleanup],
    );
  }

  if (userIdsToCleanup.length > 0) {
    await pool.query(
      `DELETE FROM users
       WHERE id = ANY($1::uuid[])`,
      [userIdsToCleanup],
    );
  }

  referralIds.length = 0;
  propertyIds.length = 0;
  userIds.length = 0;
  testEmails.length = 0;
}, DB_HOOK_TIMEOUT_MS);

afterAll(async () => {
  await pool.end();
}, DB_HOOK_TIMEOUT_MS);

describe("Referral issues — PostgreSQL integration tests", () => {
  it("allows a buyer to report an issue on their own referral", async () => {
    const response = await createIssue(buyer.accessToken, buyerReferral.id);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      referral_id: buyerReferral.id,
      reported_by: buyer.id,
      category: "communication",
      status: "open",
    });
  });

  it("allows the assigned seller to report an issue", async () => {
    const response = await createIssue(
      assignedSeller.accessToken,
      buyerReferral.id,
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      referral_id: buyerReferral.id,
      reported_by: assignedSeller.id,
      status: "open",
    });
  });

  it("rejects an unassigned seller reporting on another seller's referral", async () => {
    const response = await createIssue(
      unassignedSeller.accessToken,
      buyerReferral.id,
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("REFERRAL_ACCESS_DENIED");
  });

  it("rejects a buyer reporting on another buyer's referral", async () => {
    const response = await createIssue(
      buyer.accessToken,
      anotherBuyerReferral.id,
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("REFERRAL_ACCESS_DENIED");
  });

  it("allows an admin to list reports with reporter and property information", async () => {
    await createIssue(buyer.accessToken, buyerReferral.id);

    const response = await request(app)
      .get("/api/v1/referral-issues/admin")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);

    const issue = response.body.data.find(
      (item: { referral_id: string }) => item.referral_id === buyerReferral.id,
    );

    expect(issue).toMatchObject({
      reported_by: buyer.id,
      reporter_name: expect.any(String),
      reporter_email: buyer.email,
      reporter_role: "buyer",
      reporter_phone: "0911000001",
      reference_code: expect.any(String),
      property_id: propertyId,
      property_title: expect.stringContaining("Test Property"),
      buyer_id: buyer.id,
      assigned_seller_id: assignedSeller.id,
    });
  });

  it("allows an admin to retrieve full report details", async () => {
    const created = await createIssue(buyer.accessToken, buyerReferral.id);

    const issueId = created.body.data.id;

    const response = await request(app)
      .get(`/api/v1/referral-issues/admin/${issueId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: issueId,
      reported_by: buyer.id,
      reporter_email: buyer.email,
      property_id: propertyId,
      buyer_id: buyer.id,
      assigned_seller_id: assignedSeller.id,
    });
  });

  it("prevents a non-admin from accessing admin report endpoints", async () => {
    const response = await request(app)
      .get("/api/v1/referral-issues/admin")
      .set("Authorization", `Bearer ${buyer.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("allows an admin to update a report and record its resolution", async () => {
    const created = await createIssue(buyer.accessToken, buyerReferral.id);

    const issueId = created.body.data.id;

    const reviewResponse = await request(app)
      .patch(`/api/v1/referral-issues/admin/${issueId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        status: "under_review",
        adminNotes: "Investigating the reported communication issue.",
      });

    expect(reviewResponse.status).toBe(200);

    const resolveResponse = await request(app)
      .patch(`/api/v1/referral-issues/admin/${issueId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        status: "resolved",
        resolution: "The communication issue has been addressed.",
      });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.data).toMatchObject({
      status: "resolved",
      resolution: "The communication issue has been addressed.",
      reviewed_by: admin.id,
    });

    expect(resolveResponse.body.data.resolved_at).not.toBeNull();
  });

  it("rejects resolving a report without a resolution", async () => {
    const created = await createIssue(buyer.accessToken, buyerReferral.id);

    const response = await request(app)
      .patch(`/api/v1/referral-issues/admin/${created.body.data.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        status: "resolved",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("RESOLUTION_REQUIRED");
  });

  it("rejects invalid report status transitions", async () => {
    const created = await createIssue(buyer.accessToken, buyerReferral.id);

    const reviewResponse = await request(app)
      .patch(`/api/v1/referral-issues/admin/${created.body.data.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        status: "under_review",
        adminNotes: "Investigating the issue.",
      });

    expect(reviewResponse.status).toBe(200);

    const response = await request(app)
      .patch(`/api/v1/referral-issues/admin/${created.body.data.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        status: "open",
        adminNotes: "Attempted to reopen after review.",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_ISSUE_STATUS_TRANSITION");
  });

  it("does not allow a reporter to set administrative fields during submission", async () => {
    const response = await request(app)
      .post("/api/v1/referral-issues")
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .send({
        referralId: buyerReferral.id,
        category: "communication",
        subject: "Test administrative field protection",
        description:
          "Testing that client-supplied administrative fields are ignored.",
        reportedBy: admin.id,
        status: "resolved",
        adminNotes: "Injected admin note",
        resolution: "Injected resolution",
        reviewedBy: admin.id,
      });

    expect(response.status).toBe(201);

    const result = await pool.query(
      `SELECT reported_by, status, admin_notes, resolution, reviewed_by
       FROM referral_issues
       WHERE id = $1`,
      [response.body.data.id],
    );

    expect(result.rows[0]).toMatchObject({
      reported_by: buyer.id,
      status: "open",
      admin_notes: null,
      resolution: null,
      reviewed_by: null,
    });
  });
});
