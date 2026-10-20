import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { AppRole } from "../../src/queries/authQueries";
import { pool } from "../../src/config/database";
import app from "../../src/app";
import { signAccessToken } from "../../src/utils/jwt";

const testUserIds: string[] = [];

type TestRole = Extract<
  AppRole,
  "agent" | "developer" | "buyer" | "admin" | "finance_admin"
>;
type TestAccountStatus = "pending" | "approved" | "rejected";

const validApplication = {
  legalName: "Sola Verification Test",
  registrationNumber: `REG-${randomUUID()}`,
  businessName: "Test Realty Group",
  businessAddress: "1 Test Street, Bahir Dar",
  contactPhone: "+251900000001",
  notes: "Created by the account verification integration test.",
};

async function createTestUser(
  role: TestRole,
  options: { status?: TestAccountStatus; emailVerified?: boolean } = {},
) {
  const email = `account-verification-${randomUUID()}@example.test`;
  const status = options.status ?? "pending";
  const emailVerified = options.emailVerified ?? true;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, $5::account_status,
             CASE WHEN $6 THEN NOW() ELSE NULL END)
     RETURNING id`,
    [
      "Account Verification Test User",
      email,
      "test-only-hash",
      role,
      status,
      emailVerified,
    ],
  );
  const userId = result.rows[0]?.id;

  if (!userId) {
    throw new Error("Could not create account-verification test user.");
  }

  testUserIds.push(userId);

  return {
    id: userId,
    token: await signAccessToken({ userId, role }),
  };
}

function submitApplication(token: string, body = validApplication) {
  return request(app)
    .post("/api/v1/account-verification")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function decideRequest(
  token: string,
  requestId: string,
  body: { decision: "approved" | "rejected"; rejectionReason?: string },
) {
  return request(app)
    .patch(`/api/v1/admin/account-verification/${requestId}/decision`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

afterEach(async () => {
  const userIds = testUserIds.splice(0);

  if (userIds.length === 0) return;

  await pool.query(
    `DELETE FROM account_verification_requests
     WHERE user_id = ANY($1::uuid[]) OR reviewed_by = ANY($1::uuid[])`,
    [userIds],
  );
  await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
});

afterAll(async () => {
  await pool.end();
});

describe("account verification routes", () => {
  it.each(["agent", "developer"] as const)(
    "allows a verified %s to submit an application and view its history",
    async (role) => {
      const applicant = await createTestUser(role);

      const submission = await submitApplication(applicant.token);

      expect(submission.status).toBe(201);
      expect(submission.body.request).toMatchObject({
        user_id: applicant.id,
        applicant_role: role,
        status: "pending",
      });

      const history = await request(app)
        .get("/api/v1/account-verification/me")
        .set("Authorization", `Bearer ${applicant.token}`);

      expect(history.status).toBe(200);
      expect(history.body.requests).toHaveLength(1);
      expect(history.body.requests[0].id).toBe(submission.body.request.id);
    },
  );

  it("allows an admin to inspect and approve an agent application", async () => {
    const applicant = await createTestUser("agent");
    const admin = await createTestUser("admin", { status: "approved" });
    const submission = await submitApplication(applicant.token);
    const requestId = submission.body.request.id as string;

    const pending = await request(app)
      .get("/api/v1/admin/account-verification?page=1&pageSize=10")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(pending.status).toBe(200);
    expect(pending.body.requests).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requestId })]),
    );

    const details = await request(app)
      .get(`/api/v1/admin/account-verification/${requestId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(details.status).toBe(200);
    expect(details.body.request.user_id).toBe(applicant.id);

    const decision = await decideRequest(admin.token, requestId, {
      decision: "approved",
    });

    expect(decision.status).toBe(200);
    expect(decision.body.request.status).toBe("approved");

    const account = await pool.query<{ status: string }>(
      "SELECT status FROM users WHERE id = $1",
      [applicant.id],
    );
    expect(account.rows[0]?.status).toBe("approved");
  });

  it("requires a rejection reason and allows a rejected developer to resubmit", async () => {
    const applicant = await createTestUser("developer");
    const admin = await createTestUser("admin", { status: "approved" });
    const submission = await submitApplication(applicant.token);
    const requestId = submission.body.request.id as string;

    const missingReason = await decideRequest(admin.token, requestId, {
      decision: "rejected",
    });
    expect(missingReason.status).toBe(400);
    expect(missingReason.body.code).toBe("REJECTION_REASON_REQUIRED");

    const rejection = await decideRequest(admin.token, requestId, {
      decision: "rejected",
      rejectionReason: "Please provide a current business license.",
    });
    expect(rejection.status).toBe(200);
    expect(rejection.body.request.status).toBe("rejected");

    const account = await pool.query<{ status: string }>(
      "SELECT status FROM users WHERE id = $1",
      [applicant.id],
    );
    expect(account.rows[0]?.status).toBe("rejected");

    const resubmission = await submitApplication(applicant.token);
    expect(resubmission.status).toBe(201);
    expect(resubmission.body.request.status).toBe("pending");

    const updatedAccount = await pool.query<{ status: string }>(
      "SELECT status FROM users WHERE id = $1",
      [applicant.id],
    );
    expect(updatedAccount.rows[0]?.status).toBe("pending");

    const duplicateDecision = await decideRequest(admin.token, requestId, {
      decision: "approved",
    });
    expect(duplicateDecision.status).toBe(409);
    expect(duplicateDecision.body.code).toBe("REQUEST_ALREADY_DECIDED");
  });

  it("blocks unauthenticated, unverified, and ineligible users", async () => {
    const verifiedBuyer = await createTestUser("buyer", { status: "approved" });
    const unverifiedAgent = await createTestUser("agent", {
      emailVerified: false,
    });

    const unauthenticated = await request(app).get(
      "/api/v1/account-verification/me",
    );
    expect(unauthenticated.status).toBe(401);

    const buyerSubmission = await submitApplication(verifiedBuyer.token);
    expect(buyerSubmission.status).toBe(403);
    expect(buyerSubmission.body.code).toBe("ROLE_NOT_ELIGIBLE");

    const unverifiedSubmission = await submitApplication(unverifiedAgent.token);
    expect(unverifiedSubmission.status).toBe(403);
    expect(unverifiedSubmission.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("restricts admin review routes to admins and rejects invalid application data", async () => {
    const applicant = await createTestUser("agent");
    const financeAdmin = await createTestUser("finance_admin", {
      status: "approved",
    });

    const unauthorizedReview = await request(app)
      .get("/api/v1/admin/account-verification")
      .set("Authorization", `Bearer ${financeAdmin.token}`);
    expect(unauthorizedReview.status).toBe(403);
    expect(unauthorizedReview.body.code).toBe("ROLE_NOT_ALLOWED");

    const invalidSubmission = await submitApplication(applicant.token, {
      legalName: "A",
    });
    expect(invalidSubmission.status).toBe(400);
    expect(invalidSubmission.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a second pending application for the same user", async () => {
    const applicant = await createTestUser("agent");

    const firstSubmission = await submitApplication(applicant.token);
    expect(firstSubmission.status).toBe(201);

    const duplicateSubmission = await submitApplication(applicant.token);
    expect(duplicateSubmission.status).toBe(409);
    expect(duplicateSubmission.body.code).toBe("APPLICATION_ALREADY_PENDING");
  });
});
