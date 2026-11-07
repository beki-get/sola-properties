import "dotenv/config";
import express from "express";
import commissionAgreementRoutes from "../../src/routes/commissionAgreementRoutes";
import { errorHandler } from "../../src/middlewares/errorHandler";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pool } from "../../src/config/database";
import { signAccessToken } from "../../src/utils/jwt";

type TestRole = "admin" | "finance_admin" | "agent" | "developer" | "buyer";

interface TestUser {
  id: string;
  accessToken: string;
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
    "Refusing to run commission agreement integration tests: wrong database host.",
  );
}

const app = express();

app.use(express.json());
app.use("/api/v1/commission-agreements", commissionAgreementRoutes);
app.use(errorHandler);

const createdUserIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdReferralIds: string[] = [];
const createdTransactionIds: string[] = [];
const createdCommissionIds: string[] = [];
const createdAdjustmentIds: string[] = [];

async function createTestUser(
  role: TestRole,
  status: "approved" | "pending" = "approved",
): Promise<TestUser> {
  const email = `commission-agreement-${crypto.randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id`,
    [
      "Commission Agreement Test User",
      email,
      "unused-test-password-hash",
      role,
      status,
    ],
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

async function createAgreement(
  actor: TestUser,
  body: {
    sellerId?: string;
    commissionRatePct: number;
    platformSharePct: number;
  },
) {
  const response = await request(app)
    .post("/api/v1/commission-agreements")
    .set("Authorization", `Bearer ${actor.accessToken}`)
    .send(body);

  if (response.status === 201 && response.body.data?.id) {
    createdAgreementIds.push(response.body.data.id);
  }

  return response;
}

interface CommissionFixture {
  commissionId: string;
  transactionId: string;
  propertyId: string;
  referralId: string;
}

async function createCommissionFixture(
  seller: TestUser,
  buyer: TestUser,
  options?: {
    saleAmount?: string;
    commissionRatePct?: string;
    platformSharePct?: string;
    status?: "pending" | "approved";
  },
): Promise<CommissionFixture> {
  const saleAmount = options?.saleAmount ?? "100000.00";
  const commissionRatePct = options?.commissionRatePct ?? "3.00";
  const platformSharePct = options?.platformSharePct ?? "20.00";
  const status = options?.status ?? "pending";

  const propertyResult = await pool.query<{ id: string }>(
    `INSERT INTO properties (
       owner_id, title, property_type, location, price
     )
     VALUES ($1, $2, 'apartment', 'Bahir Dar', $3)
     RETURNING id`,
    [seller.id, `Commission Test Property ${crypto.randomUUID()}`, saleAmount],
  );

  const propertyId = propertyResult.rows[0]?.id;
  if (!propertyId) throw new Error("Failed to create test property.");
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
  if (!referralId) throw new Error("Failed to create test referral.");
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
     VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'verified', $4, NOW())
     RETURNING id`,
    [referralId, buyer.id, propertyId, seller.id, saleAmount],
  );

  const transactionId = transactionResult.rows[0]?.id;
  if (!transactionId) throw new Error("Failed to create test transaction.");
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
       seller_amount,
       status,
       approved_by,
       approved_at
     )
     SELECT
       $1,
       $2,
       ca.id,
       $3::numeric,
       $4::numeric,
       $5::numeric,
       ($3::numeric * $4::numeric / 100)::numeric(14,2),
       (
         ($3::numeric * $4::numeric / 100) * $5::numeric / 100
       )::numeric(14,2),
       (
         ($3::numeric * $4::numeric / 100)
         - (($3::numeric * $4::numeric / 100) * $5::numeric / 100)
       )::numeric(14,2),
       $6,
       CASE WHEN $6 = 'approved' THEN $7::uuid ELSE NULL END,
       CASE WHEN $6 = 'approved' THEN NOW() ELSE NULL END
     FROM commission_agreements ca
     WHERE ca.seller_id = $2
       AND ca.effective_to IS NULL
     RETURNING id`,
    [
      transactionId,
      seller.id,
      saleAmount,
      commissionRatePct,
      platformSharePct,
      status,
      seller.id,
    ],
  );

  const commissionId = commissionResult.rows[0]?.id;

  if (!commissionId) {
    throw new Error(
      "Failed to create test commission. Create an active seller agreement first.",
    );
  }

  createdCommissionIds.push(commissionId);

  return {
    commissionId,
    transactionId,
    propertyId,
    referralId,
  };
}

describe("Commission agreements integration", () => {
  let admin: TestUser;
  let financeAdmin: TestUser;
  let seller: TestUser;
  let buyer: TestUser;

  beforeAll(async () => {
    admin = await createTestUser("admin");
    financeAdmin = await createTestUser("finance_admin");
    seller = await createTestUser("agent");
    buyer = await createTestUser("buyer");
  });

  afterAll(async () => {
    if (createdCommissionIds.length > 0) {
      await pool.query(
        `DELETE FROM commission_adjustments
   WHERE commission_id = ANY($1::uuid[])`,
        [createdCommissionIds],
      );
      await pool.query(
        `DELETE FROM commission_payments
       WHERE commission_id = ANY($1::uuid[])`,
        [createdCommissionIds],
      );

      await pool.query(
        `DELETE FROM commissions
       WHERE id = ANY($1::uuid[])`,
        [createdCommissionIds],
      );
    }

    if (createdTransactionIds.length > 0) {
      await pool.query(
        `DELETE FROM transactions
       WHERE id = ANY($1::uuid[])`,
        [createdTransactionIds],
      );
    }

    if (createdReferralIds.length > 0) {
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

      await pool.query(
        `DELETE FROM referrals
       WHERE id = ANY($1::uuid[])`,
        [createdReferralIds],
      );
    }

    if (createdPropertyIds.length > 0) {
      await pool.query(
        `DELETE FROM properties
       WHERE id = ANY($1::uuid[])`,
        [createdPropertyIds],
      );
    }

    if (createdAgreementIds.length > 0) {
      await pool.query(
        `DELETE FROM commission_agreements
       WHERE id = ANY($1::uuid[])`,
        [createdAgreementIds],
      );
    }

    if (createdUserIds.length > 0) {
      await pool.query(
        `DELETE FROM audit_logs
       WHERE actor_id = ANY($1::uuid[])`,
        [createdUserIds],
      );

      await pool.query(
        `DELETE FROM users
       WHERE id = ANY($1::uuid[])`,
        [createdUserIds],
      );
    }
  });

  it("creates a platform-default agreement when sellerId is omitted", async () => {
    const response = await createAgreement(admin, {
      commissionRatePct: 3,
      platformSharePct: 20,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.seller_id).toBeNull();
    expect(response.body.data.commission_rate_pct).toBe("3.00");
    expect(response.body.data.platform_share_pct).toBe("20.00");
  });

  it("creates an agreement for an approved seller", async () => {
    const response = await createAgreement(financeAdmin, {
      sellerId: seller.id,
      commissionRatePct: 5,
      platformSharePct: 20,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.seller_id).toBe(seller.id);
    expect(response.body.data.commission_rate_pct).toBe("5.00");
  });

  it("closes the previous active agreement instead of changing it", async () => {
    const first = await createAgreement(admin, {
      commissionRatePct: 3,
      platformSharePct: 20,
    });

    const second = await createAgreement(admin, {
      commissionRatePct: 4,
      platformSharePct: 25,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const result = await pool.query(
      `SELECT id, commission_rate_pct, effective_to
       FROM commission_agreements
       WHERE id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [[first.body.data.id, second.body.data.id]],
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].commission_rate_pct).toBe("3.00");
    expect(result.rows[0].effective_to).not.toBeNull();
    expect(result.rows[1].commission_rate_pct).toBe("4.00");
    expect(result.rows[1].effective_to).toBeNull();
  });

  it("rejects a seller who is not approved", async () => {
    const pendingSeller = await createTestUser("agent", "pending");

    const response = await createAgreement(admin, {
      sellerId: pendingSeller.id,
      commissionRatePct: 5,
      platformSharePct: 20,
    });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("APPROVED_SELLER_NOT_FOUND");
  });

  it("rejects a non-staff caller", async () => {
    const response = await createAgreement(seller, {
      commissionRatePct: 3,
      platformSharePct: 20,
    });

    expect(response.status).toBe(403);
  });

  it("rejects invalid agreement percentages", async () => {
    const response = await createAgreement(admin, {
      commissionRatePct: 0,
      platformSharePct: 20,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unexpected body fields", async () => {
    const response = await request(app)
      .post("/api/v1/commission-agreements")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        commissionRatePct: 3,
        platformSharePct: 20,
        createdBy: buyer.id,
      });

    expect(response.status).toBe(400);
  });

  it("writes an audit record for a created agreement", async () => {
    const response = await createAgreement(admin, {
      commissionRatePct: 3,
      platformSharePct: 20,
    });

    expect(response.status).toBe(201);

    const audit = await pool.query(
      `SELECT *
       FROM audit_logs
       WHERE entity_type = 'commission_agreement'
         AND entity_id = $1
         AND actor_id = $2`,
      [response.body.data.id, admin.id],
    );

    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].action).toBe("commission_agreement.created");
  });

  it("allows admin to retrieve all commission agreements", async () => {
    const created = await createAgreement(admin, {
      commissionRatePct: 3,
      platformSharePct: 20,
    });

    expect(created.status).toBe(201);

    const response = await request(app)
      .get("/api/v1/commission-agreements")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.data.id }),
      ]),
    );
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
    });
  });

  it("allows finance admin to retrieve all commission agreements", async () => {
    const response = await request(app)
      .get("/api/v1/commission-agreements")
      .set("Authorization", `Bearer ${financeAdmin.accessToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("allows a seller to retrieve only their own agreements", async () => {
    const created = await createAgreement(admin, {
      sellerId: seller.id,
      commissionRatePct: 5,
      platformSharePct: 20,
    });

    expect(created.status).toBe(201);

    const response = await request(app)
      .get("/api/v1/commission-agreements")
      .set("Authorization", `Bearer ${seller.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(
      response.body.data.every(
        (agreement: { seller_id: string }) => agreement.seller_id === seller.id,
      ),
    ).toBe(true);
  });

  it("rejects buyers from retrieving commission agreements", async () => {
    const buyer = await createTestUser("buyer");

    const response = await request(app)
      .get("/api/v1/commission-agreements")
      .set("Authorization", `Bearer ${buyer.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("rejects invalid pagination parameters", async () => {
    const response = await request(app)
      .get("/api/v1/commission-agreements?page=0")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("supports pagination", async () => {
    const response = await request(app)
      .get("/api/v1/commission-agreements?page=1&limit=1")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeLessThanOrEqual(1);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
    });
  });

  describe("Commission adjustments", () => {
    async function createApprovedCommission() {
      const agreementResponse = await createAgreement(admin, {
        sellerId: seller.id,
        commissionRatePct: 3,
        platformSharePct: 20,
      });

      expect(agreementResponse.status).toBe(201);

      const fixture = await createCommissionFixture(seller, buyer, {
        saleAmount: "100000.00",
        commissionRatePct: "3.00",
        platformSharePct: "20.00",
        status: "approved",
      });

      return fixture;
    }

    async function createAdjustment(
      actor: TestUser,
      commissionId: string,
      amount: string,
      reason = "Integration test adjustment",
    ) {
      return request(app)
        .post(`/api/v1/commission-agreements/${commissionId}/adjustments`)
        .set("Authorization", `Bearer ${actor.accessToken}`)
        .send({ amount, reason });
    }

    async function recordPayment(commissionId: string, amount: string) {
      return request(app)
        .post(
          `/api/v1/commission-agreements/commissions/${commissionId}/payments`,
        )
        .set("Authorization", `Bearer ${financeAdmin.accessToken}`)
        .send({
          amount,
          paidOn: "2026-11-07",
          reference: "ADJUSTMENT-TEST-PAYMENT",
        });
    }

    it("should create a positive adjustment and update the commission statement", async () => {
      const fixture = await createApprovedCommission();

      // Original platform amount:
      // 100000 * 3% * 20% = 600
      const response = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "100.00",
      );

      expect(response.status).toBe(201);
      expect(response.body.data).toBeDefined();

      const statement = await request(app)
        .get(
          `/api/v1/commission-agreements/commissions/${fixture.commissionId}`,
        )
        .set("Authorization", `Bearer ${financeAdmin.accessToken}`);

      expect(statement.status).toBe(200);
      expect(statement.body.data.adjustment_total).toBe("100.00");
      expect(statement.body.data.amount_owed).toBe("700.00");
      expect(statement.body.data.outstanding).toBe("700.00");
    });

    it("should create a negative adjustment and reduce the amount owed", async () => {
      const fixture = await createApprovedCommission();

      const response = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "-100.00",
      );

      expect(response.status).toBe(201);

      const statement = await request(app)
        .get(
          `/api/v1/commission-agreements/commissions/${fixture.commissionId}`,
        )
        .set("Authorization", `Bearer ${financeAdmin.accessToken}`);

      expect(statement.status).toBe(200);
      expect(statement.body.data.amount_owed).toBe("500.00");
      expect(statement.body.data.outstanding).toBe("500.00");
    });

    it("should reject an adjustment that makes the amount owed negative", async () => {
      const fixture = await createApprovedCommission();

      const response = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "-700.00",
      );

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("INVALID_COMMISSION_ADJUSTMENT");
    });

    it("should reject an adjustment that reduces the amount owed below the amount already paid", async () => {
      const fixture = await createApprovedCommission();

      const paymentResponse = await recordPayment(
        fixture.commissionId,
        "400.00",
      );

      expect(paymentResponse.status).toBe(201);

      const adjustmentResponse = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "-300.00",
      );

      expect(adjustmentResponse.status).toBe(409);
      expect(adjustmentResponse.body.code).toBe(
        "INVALID_COMMISSION_ADJUSTMENT",
      );
    });

    it("should allow payment up to the adjusted amount owed", async () => {
      const fixture = await createApprovedCommission();

      const adjustmentResponse = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "100.00",
      );

      expect(adjustmentResponse.status).toBe(201);

      const paymentResponse = await recordPayment(
        fixture.commissionId,
        "700.00",
      );

      expect(paymentResponse.status).toBe(201);
      expect(paymentResponse.body.data.outstanding).toBe("0.00");
    });

    it("should reject payment exceeding the adjusted amount owed", async () => {
      const fixture = await createApprovedCommission();

      const adjustmentResponse = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "100.00",
      );

      expect(adjustmentResponse.status).toBe(201);

      const paymentResponse = await recordPayment(
        fixture.commissionId,
        "701.00",
      );

      expect(paymentResponse.status).toBe(409);
      expect(paymentResponse.body.code).toBe("PAYMENT_EXCEEDS_OUTSTANDING");
    });

    it("should reject an adjustment with a zero amount", async () => {
      const fixture = await createApprovedCommission();

      const response = await createAdjustment(
        financeAdmin,
        fixture.commissionId,
        "0",
      );

      expect(response.status).toBe(400);
    });

    it("should reject an adjustment without a reason", async () => {
      const fixture = await createApprovedCommission();

      const response = await request(app)
        .post(
          `/api/v1/commission-agreements/${fixture.commissionId}/adjustments`,
        )
        .set("Authorization", `Bearer ${financeAdmin.accessToken}`)
        .send({ amount: "100.00" });

      expect(response.status).toBe(400);
    });

    it("should reject an unauthorized seller creating an adjustment", async () => {
      const fixture = await createApprovedCommission();

      const response = await createAdjustment(
        seller,
        fixture.commissionId,
        "100.00",
      );

      expect(response.status).toBe(403);
    });
  });
});

describe("Commission endpoints integration", () => {
  let admin: TestUser;
  let financeAdmin: TestUser;
  let seller: TestUser;
  let anotherSeller: TestUser;
  let buyer: TestUser;

  beforeAll(async () => {
    admin = await createTestUser("admin");
    financeAdmin = await createTestUser("finance_admin");
    seller = await createTestUser("agent");
    anotherSeller = await createTestUser("developer");
    buyer = await createTestUser("buyer");
  });

  async function createSellerAgreement(user: TestUser) {
    const response = await createAgreement(admin, {
      sellerId: user.id,
      commissionRatePct: 3,
      platformSharePct: 20,
    });

    expect(response.status).toBe(201);
    return response;
  }

  async function approveCommission(commissionId: string) {
    return request(app)
      .post(`/api/v1/commission-agreements/commissions/${commissionId}/approve`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
  }

  it("allows a seller to retrieve only their own commissions", async () => {
    await createSellerAgreement(seller);
    await createSellerAgreement(anotherSeller);

    const own = await createCommissionFixture(seller, buyer);
    await createCommissionFixture(anotherSeller, buyer);

    const response = await request(app)
      .get("/api/v1/commission-agreements/commissions")
      .set("Authorization", `Bearer ${seller.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: own.commissionId,
          sellerId: seller.id,
        }),
      ]),
    );

    expect(
      response.body.data.every(
        (commission: { sellerId: string }) => commission.sellerId === seller.id,
      ),
    ).toBe(true);
  });

  it("allows staff to retrieve commissions across sellers", async () => {
    const response = await request(app)
      .get("/api/v1/commission-agreements/commissions")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("rejects a seller-supplied sellerId filter", async () => {
    const response = await request(app)
      .get(
        `/api/v1/commission-agreements/commissions?sellerId=${anotherSeller.id}`,
      )
      .set("Authorization", `Bearer ${seller.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("supports commission status filtering", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await request(app)
      .get("/api/v1/commission-agreements/commissions?status=pending")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.commissionId,
          status: "pending",
        }),
      ]),
    );
  });

  it("returns a summary for the filtered commissions", async () => {
    await createSellerAgreement(seller);
    await createCommissionFixture(seller, buyer, {
      saleAmount: "100000.00",
    });

    const response = await request(app)
      .get("/api/v1/commission-agreements/commissions?status=pending")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      total_commission: expect.any(String),
      platform_amount: expect.any(String),
      paid_total: expect.any(String),
      outstanding: expect.any(String),
    });
  });

  it("supports pagination", async () => {
    const response = await request(app)
      .get("/api/v1/commission-agreements/commissions?page=1&limit=1")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeLessThanOrEqual(1);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
    });
  });

  it("allows a seller to retrieve their commission statement", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await request(app)
      .get(`/api/v1/commission-agreements/commissions/${fixture.commissionId}`)
      .set("Authorization", `Bearer ${seller.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: fixture.commissionId,
      seller_id: seller.id,
      property_title: expect.any(String),
      reference_code: expect.any(String),
      paid_total: "0.00",
      outstanding: expect.any(String),
      payments: [],
    });
  });

  it("hides another seller's commission statement", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await request(app)
      .get(`/api/v1/commission-agreements/commissions/${fixture.commissionId}`)
      .set("Authorization", `Bearer ${anotherSeller.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent commission statement", async () => {
    const nonexistentId = crypto.randomUUID();

    const response = await request(app)
      .get(`/api/v1/commission-agreements/commissions/${nonexistentId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("allows admin to approve a pending commission and writes audit and notification records", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await approveCommission(fixture.commissionId);

    expect(response.status).toBe(200);

    const commissionResult = await pool.query(
      `SELECT status, approved_by, approved_at
       FROM commissions
       WHERE id = $1`,
      [fixture.commissionId],
    );

    expect(commissionResult.rows[0]).toMatchObject({
      status: "approved",
      approved_by: admin.id,
    });
    expect(commissionResult.rows[0].approved_at).not.toBeNull();

    const audit = await pool.query(
      `SELECT action
       FROM audit_logs
       WHERE entity_type = 'commission'
         AND entity_id = $1
         AND actor_id = $2`,
      [fixture.commissionId, admin.id],
    );

    expect(audit.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "commission.approved",
        }),
      ]),
    );

    const notification = await pool.query(
      `SELECT type
       FROM notifications
       WHERE recipient_id = $1
         AND entity_type = 'commission'
         AND entity_id = $2`,
      [seller.id, fixture.commissionId],
    );

    expect(notification.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "commission_approved",
        }),
      ]),
    );
  });

  it("allows finance admin to approve a commission", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/approve`,
      )
      .set("Authorization", `Bearer ${financeAdmin.accessToken}`);

    expect(response.status).toBe(200);
  });

  it("rejects a seller attempting to approve a commission", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/approve`,
      )
      .set("Authorization", `Bearer ${seller.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("rejects approving an already approved commission", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const first = await approveCommission(fixture.commissionId);
    expect(first.status).toBe(200);

    const second = await approveCommission(fixture.commissionId);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("COMMISSION_NOT_PENDING");
  });

  it("records a payment against an approved commission", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      saleAmount: "100000.00",
      status: "approved",
    });

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        amount: "100.00",
        paidOn: new Date().toISOString().slice(0, 10),
        reference: "TEST-PAYMENT-001",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      paidTotal: "100.00",
      outstanding: "500.00",
    });

    const payments = await pool.query(
      `SELECT amount::text, reference, recorded_by
       FROM commission_payments
       WHERE commission_id = $1`,
      [fixture.commissionId],
    );

    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0]).toMatchObject({
      amount: "100.00",
      reference: "TEST-PAYMENT-001",
      recorded_by: admin.id,
    });
  });

  it("marks the commission paid when the platform amount is fully paid", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      saleAmount: "100000.00",
      status: "approved",
    });

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        amount: "600.00",
        paidOn: new Date().toISOString().slice(0, 10),
      });

    expect(response.status).toBe(201);

    const result = await pool.query(
      `SELECT status
       FROM commissions
       WHERE id = $1`,
      [fixture.commissionId],
    );

    expect(result.rows[0].status).toBe("paid");
  });

  it("rejects a payment exceeding the outstanding platform commission", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      saleAmount: "100000.00",
      status: "approved",
    });

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        amount: "601.00",
        paidOn: new Date().toISOString().slice(0, 10),
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PAYMENT_EXCEEDS_OUTSTANDING");
  });

  it("rejects payments against pending commissions", async () => {
    await createSellerAgreement(seller);
    const fixture = await createCommissionFixture(seller, buyer);

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        amount: "10.00",
        paidOn: new Date().toISOString().slice(0, 10),
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("COMMISSION_NOT_APPROVED");
  });

  it("rejects a seller attempting to record a payment", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      status: "approved",
    });

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({
        amount: "10.00",
        paidOn: new Date().toISOString().slice(0, 10),
      });

    expect(response.status).toBe(403);
  });

  it("rejects invalid payment amounts", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      status: "approved",
    });

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        amount: "-10.00",
        paidOn: new Date().toISOString().slice(0, 10),
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a future payment date", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      status: "approved",
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await request(app)
      .post(
        `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`,
      )
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        amount: "10.00",
        paidOn: tomorrow.toISOString().slice(0, 10),
      });

    expect(response.status).toBe(400);
  });

  it("does not allow concurrent payments to exceed the platform commission", async () => {
    await createSellerAgreement(seller);

    const fixture = await createCommissionFixture(seller, buyer, {
      saleAmount: "100000.00",
      status: "approved",
    });

    const url = `/api/v1/commission-agreements/commissions/${fixture.commissionId}/payments`;

    const makePayment = () =>
      request(app)
        .post(url)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({
          amount: "400.00",
          paidOn: new Date().toISOString().slice(0, 10),
        });

    const responses = await Promise.all([makePayment(), makePayment()]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);

    const totals = await pool.query<{ paid_total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::numeric(14,2)::text AS paid_total
       FROM commission_payments
       WHERE commission_id = $1`,
      [fixture.commissionId],
    );

    expect(totals.rows[0].paid_total).toBe("400.00");
  });
});
