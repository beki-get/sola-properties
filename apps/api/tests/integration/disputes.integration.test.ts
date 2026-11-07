import "dotenv/config";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import disputeRoutes from "../../src/routes/disputeRoutes";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { pool } from "../../src/config/database";
import { signAccessToken } from "../../src/utils/jwt";

type TestRole = "admin" | "finance_admin" | "agent" | "developer" | "buyer";

interface TestUser {
  id: string;
  accessToken: string;
}

interface CommissionFixture {
  commissionId: string;
  sellerId: string;
}

const databaseUrl = process.env.DATABASE_URL;
const expectedTestHost = process.env.TEST_DATABASE_HOST;

if (!databaseUrl || !expectedTestHost) {
  throw new Error(
    "DATABASE_URL and TEST_DATABASE_HOST must be configured in .env.test",
  );
}

if (new URL(databaseUrl).hostname !== expectedTestHost) {
  throw new Error(
    "Refusing to run dispute integration tests: wrong database host.",
  );
}

const app = express();

app.use(express.json());
app.use("/api/v1/disputes", disputeRoutes);
app.use(errorHandler);

const createdUserIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdReferralIds: string[] = [];
const createdTransactionIds: string[] = [];
const createdCommissionIds: string[] = [];
const createdDisputeIds: string[] = [];
const createdNotificationIds: string[] = [];

async function createTestUser(role: TestRole): Promise<TestUser> {
  const email = `dispute-${crypto.randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name, email, password_hash, role, status, email_verified_at
     )
     VALUES ($1, $2, $3, $4, 'approved', NOW())
     RETURNING id`,
    ["Dispute Test User", email, "unused-test-password-hash", role],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create test user.");
  }

  createdUserIds.push(user.id);

  return {
    id: user.id,
    accessToken: await signAccessToken({
      userId: user.id,
      role,
    }),
  };
}

async function createCommissionFixture(
  seller: TestUser,
  buyer: TestUser,
): Promise<CommissionFixture> {
  const agreementResult = await pool.query<{ id: string }>(
    `INSERT INTO commission_agreements (
       seller_id,
       commission_rate_pct,
       platform_share_pct
     )
     VALUES ($1, 3.00, 20.00)
     RETURNING id`,
    [seller.id],
  );

  const agreementId = agreementResult.rows[0]?.id;

  if (!agreementId) {
    throw new Error("Failed to create commission agreement.");
  }

  createdAgreementIds.push(agreementId);

  const propertyResult = await pool.query<{ id: string }>(
    `INSERT INTO properties (
       owner_id, title, property_type, location, price
     )
     VALUES ($1, $2, 'apartment', 'Bahir Dar', 100000)
     RETURNING id`,
    [seller.id, `Dispute Test Property ${crypto.randomUUID()}`],
  );

  const propertyId = propertyResult.rows[0]?.id;

  if (!propertyId) throw new Error("Failed to create property.");

  createdPropertyIds.push(propertyId);

  const referralResult = await pool.query<{ id: string }>(
    `INSERT INTO referrals (
       buyer_id, property_id, assigned_to, status
     )
     VALUES ($1, $2, $3, 'closed_won')
     RETURNING id`,
    [buyer.id, propertyId, seller.id],
  );

  const referralId = referralResult.rows[0]?.id;

  if (!referralId) throw new Error("Failed to create referral.");

  createdReferralIds.push(referralId);

  const transactionResult = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
       referral_id,
       buyer_id,
       property_id,
       seller_id,
       sale_amount,
       closing_date,
       status,
       reviewed_by,
       reviewed_at
     )
     VALUES ($1, $2, $3, $4, 100000, CURRENT_DATE, 'verified', $5, NOW())
     RETURNING id`,
    [referralId, buyer.id, propertyId, seller.id, seller.id],
  );

  const transactionId = transactionResult.rows[0]?.id;

  if (!transactionId) throw new Error("Failed to create transaction.");

  createdTransactionIds.push(transactionId);

  const commissionResult = await pool.query<{ id: string }>(
    `INSERT INTO commissions (
       transaction_id,
       seller_id,
       agreement_id,
       sale_amount,
       commission_rate_pct,
       platform_share_pct,
       total_commission,
       platform_amount,
       seller_amount
     )
     VALUES (
       $1, $2, $3, 100000, 3, 20, 3000, 600, 2400
     )
     RETURNING id`,
    [transactionId, seller.id, agreementId],
  );

  const commissionId = commissionResult.rows[0]?.id;

  if (!commissionId) throw new Error("Failed to create commission.");

  createdCommissionIds.push(commissionId);

  return {
    commissionId,
    sellerId: seller.id,
  };
}

async function openCommissionDispute(
  seller: TestUser,
  commissionId: string,
  reason = "The commission calculation appears incorrect.",
) {
  const response = await request(app)
    .post(`/api/v1/disputes/commissions/${commissionId}/disputes`)
    .set("Authorization", `Bearer ${seller.accessToken}`)
    .send({ reason });

  if (response.status === 201 && response.body.dispute?.id) {
    createdDisputeIds.push(response.body.dispute.id);
  }

  return response;
}

describe("Commission disputes integration", () => {
  let admin: TestUser;
  let financeAdmin: TestUser;
  let seller: TestUser;
  let anotherSeller: TestUser;
  let buyer: TestUser;

  let fixture: CommissionFixture;

  beforeAll(async () => {
    admin = await createTestUser("admin");
    financeAdmin = await createTestUser("finance_admin");
    seller = await createTestUser("agent");
    anotherSeller = await createTestUser("developer");
    buyer = await createTestUser("buyer");

    fixture = await createCommissionFixture(seller, buyer);
  });

  afterAll(async () => {
    if (createdDisputeIds.length) {
      await pool.query(`DELETE FROM disputes WHERE id = ANY($1::uuid[])`, [
        createdDisputeIds,
      ]);
    }

    if (createdNotificationIds.length) {
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1::uuid[])`, [
        createdNotificationIds,
      ]);
    }

    if (createdCommissionIds.length) {
      await pool.query(`DELETE FROM commissions WHERE id = ANY($1::uuid[])`, [
        createdCommissionIds,
      ]);
    }

    if (createdTransactionIds.length) {
      await pool.query(`DELETE FROM transactions WHERE id = ANY($1::uuid[])`, [
        createdTransactionIds,
      ]);
    }

    if (createdReferralIds.length) {
      await pool.query(
        `DELETE FROM referral_events
         WHERE referral_id = ANY($1::uuid[])`,
        [createdReferralIds],
      );

      await pool.query(
        `DELETE FROM referral_messages
         WHERE referral_id = ANY($1::uuid[])`,
        [createdReferralIds],
      );

      await pool.query(`DELETE FROM referrals WHERE id = ANY($1::uuid[])`, [
        createdReferralIds,
      ]);
    }

    if (createdPropertyIds.length) {
      await pool.query(`DELETE FROM properties WHERE id = ANY($1::uuid[])`, [
        createdPropertyIds,
      ]);
    }

    if (createdAgreementIds.length) {
      await pool.query(
        `DELETE FROM commission_agreements WHERE id = ANY($1::uuid[])`,
        [createdAgreementIds],
      );
    }

    if (createdUserIds.length) {
      await pool.query(
        `DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])`,
        [createdUserIds],
      );

      await pool.query(
        `DELETE FROM notifications WHERE recipient_id = ANY($1::uuid[])`,
        [createdUserIds],
      );

      await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
        createdUserIds,
      ]);
    }
  });

  it("allows the commission owner to open a dispute", async () => {
    const response = await openCommissionDispute(seller, fixture.commissionId);

    expect(response.status).toBe(201);
    expect(response.body.dispute.entity_type).toBe("commission");
    expect(response.body.dispute.entity_id).toBe(fixture.commissionId);
    expect(response.body.dispute.reported_by).toBe(seller.id);
    expect(response.body.dispute.status).toBe("open");
  });

  it("rejects a second open dispute for the same commission", async () => {
    const response = await openCommissionDispute(seller, fixture.commissionId);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("OPEN_DISPUTE_EXISTS");
  });

  it("does not allow another seller to open a dispute for the commission", async () => {
    const response = await openCommissionDispute(
      anotherSeller,
      fixture.commissionId,
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("COMMISSION_NOT_FOUND");
  });

  it("rejects a dispute without a reason", async () => {
    const response = await request(app)
      .post(`/api/v1/disputes/commissions/${fixture.commissionId}/disputes`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({ reason: "   " });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_DISPUTE_INPUT");
  });

  it("allows the commission owner to retrieve their disputes", async () => {
    const response = await request(app)
      .get(`/api/v1/disputes/commissions/${fixture.commissionId}/disputes`)
      .set("Authorization", `Bearer ${seller.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].entity_type).toBe("commission");
  });

  it("allows admin to retrieve commission disputes", async () => {
    const response = await request(app)
      .get(`/api/v1/disputes/commissions/${fixture.commissionId}/disputes`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
  });

  it("does not reveal another seller's commission disputes", async () => {
    const response = await request(app)
      .get(`/api/v1/disputes/commissions/${fixture.commissionId}/disputes`)
      .set("Authorization", `Bearer ${anotherSeller.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("allows admin to resolve a commission dispute with a note", async () => {
    const disputeResponse = await request(app)
      .get(`/api/v1/disputes/commissions/${fixture.commissionId}/disputes`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    const disputeId = disputeResponse.body.items[0].id;

    const response = await request(app)
      .patch(`/api/v1/disputes/${disputeId}/decision`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        decision: "resolved",
        resolution_note: "The commission calculation was reviewed.",
      });

    expect(response.status).toBe(200);
    expect(response.body.dispute.status).toBe("resolved");
    expect(response.body.dispute.resolved_by).toBe(admin.id);
    expect(response.body.dispute.resolution_note).toBe(
      "The commission calculation was reviewed.",
    );
  });

  it("does not allow a seller to decide a dispute", async () => {
    const response = await request(app)
      .patch("/api/v1/disputes/00000000-0000-0000-0000-000000000000/decision")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({
        decision: "resolved",
        resolution_note: "Attempted seller decision.",
      });

    expect(response.status).toBe(403);
  });

  it("rejects a decision without a resolution note", async () => {
    const response = await request(app)
      .patch("/api/v1/disputes/00000000-0000-0000-0000-000000000000/decision")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        decision: "resolved",
        resolution_note: "   ",
      });

    expect(response.status).toBe(400);
  });

  it("does not allow a dispute to be decided twice", async () => {
    const disputeResponse = await request(app)
      .get(`/api/v1/disputes/commissions/${fixture.commissionId}/disputes`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    const disputeId = disputeResponse.body.items[0].id;

    const response = await request(app)
      .patch(`/api/v1/disputes/${disputeId}/decision`)
      .set("Authorization", `Bearer ${financeAdmin.accessToken}`)
      .send({
        decision: "rejected",
        resolution_note: "Second decision attempt.",
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DISPUTE_ALREADY_CLOSED");
  });

  it("writes audit records for dispute creation and decision", async () => {
    const result = await pool.query<{ action: string }>(
      `SELECT action
       FROM audit_logs
       WHERE entity_type = 'dispute'
         AND entity_id = (
           SELECT id
           FROM disputes
           WHERE entity_type = 'commission'
             AND entity_id = $1
           ORDER BY created_at DESC
           LIMIT 1
         )`,
      [fixture.commissionId],
    );

    const actions = result.rows.map((row) => row.action);

    expect(actions).toContain("commission.dispute_opened");
    expect(actions).toContain("commission.dispute_resolved");
  });

  it("does not change the commission amount when a dispute is resolved", async () => {
    const result = await pool.query<{ platform_amount: string }>(
      `SELECT platform_amount
       FROM commissions
       WHERE id = $1`,
      [fixture.commissionId],
    );

    expect(result.rows[0]?.platform_amount).toBe("600.00");
  });
});
