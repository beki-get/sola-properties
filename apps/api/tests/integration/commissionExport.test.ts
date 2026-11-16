
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
const testCategoryIds: string[] = [];
const testLocationIds: string[] = [];
const testPropertyIds: string[] = [];
const testReferralIds: string[] = [];
const testTransactionIds: string[] = [];
const testAgreementIds: string[] = [];
const testCommissionIds: string[] = [];

type TestRole = Extract<
  AppRole,
  "admin" | "finance_admin" | "buyer" | "agent" | "developer"
>;

async function createTestUser(role: TestRole, fullName: string) {
  const email = `commission-export-${randomUUID()}@example.test`;

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
    [`Commission Category ${randomUUID()}`],
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
    [`Commission Location ${randomUUID()}`],
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
  sellerId: string;
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
      input.sellerId,
      "Commission export test referral",
    ],
  );

  const referral = result.rows[0];
  if (!referral) throw new Error("Could not create test referral.");

  testReferralIds.push(referral.id);
  return referral;
}

async function createTestTransaction(input: {
  referralId: string;
  buyerId: string;
  propertyId: string;
  sellerId: string;
  closingDate: string;
  saleAmount: number;
}) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
       referral_id, buyer_id, property_id, seller_id,
       sale_amount, closing_date, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'verified')
     RETURNING id`,
    [
      input.referralId,
      input.buyerId,
      input.propertyId,
      input.sellerId,
      input.saleAmount,
      input.closingDate,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test transaction.");

  testTransactionIds.push(id);
  return id;
}

async function createTestAgreement(sellerId: string) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO commission_agreements (
       seller_id, commission_rate_pct, platform_share_pct,
       effective_from
     )
     VALUES ($1, 5, 20, NOW())
     RETURNING id`,
    [sellerId],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test commission agreement.");

  testAgreementIds.push(id);
  return id;
}

async function createTestCommission(input: {
  transactionId: string;
  sellerId: string;
  agreementId: string;
  saleAmount: number;
  status?: "pending" | "approved" | "paid";
  createdAt?: string;
}) {
  const totalCommission = input.saleAmount * 0.05;
  const platformAmount = totalCommission * 0.2;
  const sellerAmount = totalCommission - platformAmount;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO commissions (
       transaction_id, seller_id, agreement_id,
       sale_amount, commission_rate_pct, platform_share_pct,
       total_commission, platform_amount, seller_amount,
       status, created_at
     )
     VALUES ($1, $2, $3, $4, 5, 20, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.transactionId,
      input.sellerId,
      input.agreementId,
      input.saleAmount,
      totalCommission,
      platformAmount,
      sellerAmount,
      input.status ?? "pending",
      input.createdAt ?? "2026-10-15T10:00:00Z",
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test commission.");

  testCommissionIds.push(id);
  return id;
}

async function createTestPayment(
  commissionId: string,
  recordedBy: string,
  amount: number,
) {
  await pool.query(
    `INSERT INTO commission_payments (
       commission_id, amount, paid_on, reference, recorded_by
     )
     VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
    [commissionId, amount, `TEST-${randomUUID()}`, recordedBy],
  );
}

async function createTestAdjustment(
  commissionId: string,
  createdBy: string,
  amount: number,
) {
  await pool.query(
    `INSERT INTO commission_adjustments (
       commission_id, amount, reason, created_by
     )
     VALUES ($1, $2, $3, $4)`,
    [commissionId, amount, "Commission export test adjustment", createdBy],
  );
}

async function cleanupTestData() {
  if (testCommissionIds.length) {
    await pool.query(
      `DELETE FROM commission_payments
       WHERE commission_id = ANY($1::uuid[])`,
      [testCommissionIds],
    );

    await pool.query(
      `DELETE FROM commission_adjustments
       WHERE commission_id = ANY($1::uuid[])`,
      [testCommissionIds],
    );

    await pool.query(
      `DELETE FROM commissions
       WHERE id = ANY($1::uuid[])`,
      [testCommissionIds],
    );
  }

  if (testTransactionIds.length) {
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

  if (testAgreementIds.length) {
    await pool.query(
      `DELETE FROM commission_agreements
       WHERE id = ANY($1::uuid[])`,
      [testAgreementIds],
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

  testCommissionIds.length = 0;
  testTransactionIds.length = 0;
  testReferralIds.length = 0;
  testPropertyIds.length = 0;
  testAgreementIds.length = 0;
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

describe("Commission CSV export", () => {
  it("exports all commissions with financial balances for Finance Admin", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );
    const seller = await createTestUser("agent", "Commission Seller");
    const buyer = await createTestUser("buyer", "Commission Buyer");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();

    const propertyId = await createTestProperty(
      seller.id,
      categoryId,
      locationId,
      "Commission Export Property",
    );

    const referral = await createTestReferral({
      buyerId: buyer.id,
      propertyId,
      sellerId: seller.id,
    });

    const transactionId = await createTestTransaction({
      referralId: referral.id,
      buyerId: buyer.id,
      propertyId,
      sellerId: seller.id,
      closingDate: "2026-10-14",
      saleAmount: 100000,
    });

    const agreementId = await createTestAgreement(seller.id);

    const commissionId = await createTestCommission({
      transactionId,
      sellerId: seller.id,
      agreementId,
      saleAmount: 100000,
    });

    await createTestPayment(commissionId, financeAdmin.id, 3000);
    await createTestAdjustment(commissionId, financeAdmin.id, 500);

    const response = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      "sola-commissions.csv",
    );
    expect(response.headers["cache-control"]).toBe("no-store");

    expect(response.text).toContain("Commission ID");
    expect(response.text).toContain("Transaction ID");
    expect(response.text).toContain("Buyer");
    expect(response.text).toContain("Seller");
    expect(response.text).toContain("Property");
    expect(response.text).toContain("Adjustment Total");
    expect(response.text).toContain("Paid Total");
    expect(response.text).toContain("Outstanding");

    expect(response.text).toContain(commissionId);
    expect(response.text).toContain("Commission Buyer");
    expect(response.text).toContain("Commission Seller");
    expect(response.text).toContain("Commission Export Property");

    // Sale amount = 100,000
    // Total commission = 5,000
    // Platform amount = 1,000
    // Adjustment total = 500
    // Paid total = 3,000
    // Amount owed = 1,500
    // Outstanding = -1,500
    expect(response.text).toContain("100000");
    expect(response.text).toContain("5000");
    expect(response.text).toContain("1000");
    expect(response.text).toContain("500");
    expect(response.text).toContain("3000");
    expect(response.text).toContain("1500");
  });

  it("exports all matching records without applying pagination", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );
    const seller = await createTestUser("agent", "Commission Seller");
    const buyer = await createTestUser("buyer", "Commission Buyer");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();
    const agreementId = await createTestAgreement(seller.id);

    for (const index of [0, 1, 2]) {
      const propertyId = await createTestProperty(
        seller.id,
        categoryId,
        locationId,
        `Commission Pagination Property ${index}`,
      );

      const referral = await createTestReferral({
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
      });

      const transactionId = await createTestTransaction({
        referralId: referral.id,
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
        closingDate: "2026-10-14",
        saleAmount: 100000 + index * 10000,
      });

      await createTestCommission({
        transactionId,
        sellerId: seller.id,
        agreementId,
        saleAmount: 100000 + index * 10000,
        createdAt: `2026-10-${String(15 + index).padStart(2, "0")}T10:00:00Z`,
      });
    }

    const response = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({ page: 1, limit: 1 });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Commission Pagination Property 0");
    expect(response.text).toContain("Commission Pagination Property 1");
    expect(response.text).toContain("Commission Pagination Property 2");
  });

  it("filters commissions by status", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );
    const seller = await createTestUser("agent", "Commission Seller");
    const buyer = await createTestUser("buyer", "Commission Buyer");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();
    const agreementId = await createTestAgreement(seller.id);

    for (const [index, status] of [
      "pending",
      "approved",
      "paid",
    ].entries()) {
      const propertyId = await createTestProperty(
        seller.id,
        categoryId,
        locationId,
        `Commission Status Property ${index}`,
      );

      const referral = await createTestReferral({
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
      });

      const transactionId = await createTestTransaction({
        referralId: referral.id,
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
        closingDate: "2026-10-14",
        saleAmount: 100000,
      });

      await createTestCommission({
        transactionId,
        sellerId: seller.id,
        agreementId,
        saleAmount: 100000,
        status: status as "pending" | "approved" | "paid",
      });
    }

    const response = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({ status: "approved" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Commission Status Property 1");
    expect(response.text).not.toContain("Commission Status Property 0");
    expect(response.text).not.toContain("Commission Status Property 2");
  });

  it("filters commissions by seller ID", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );
    const sellerOne = await createTestUser("agent", "Commission Seller One");
    const sellerTwo = await createTestUser("developer", "Commission Seller Two");
    const buyer = await createTestUser("buyer", "Commission Buyer");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();

    for (const [index, seller] of [sellerOne, sellerTwo].entries()) {
      const propertyId = await createTestProperty(
        seller.id,
        categoryId,
        locationId,
        `Commission Seller Property ${index}`,
      );

      const referral = await createTestReferral({
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
      });

      const transactionId = await createTestTransaction({
        referralId: referral.id,
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
        closingDate: "2026-10-14",
        saleAmount: 100000,
      });

      const agreementId = await createTestAgreement(seller.id);

      await createTestCommission({
        transactionId,
        sellerId: seller.id,
        agreementId,
        saleAmount: 100000,
      });
    }

    const response = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({ sellerId: sellerOne.id });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Commission Seller Property 0");
    expect(response.text).not.toContain("Commission Seller Property 1");
  });

  it("filters commissions by creation date range", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );
    const seller = await createTestUser("agent", "Commission Seller");
    const buyer = await createTestUser("buyer", "Commission Buyer");

    const categoryId = await createTestCategory();
    const locationId = await createTestLocation();
    const agreementId = await createTestAgreement(seller.id);

    for (const [index, date] of [
      "2026-10-10",
      "2026-10-15",
      "2026-10-20",
    ].entries()) {
      const propertyId = await createTestProperty(
        seller.id,
        categoryId,
        locationId,
        `Commission Date Property ${index}`,
      );

      const referral = await createTestReferral({
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
      });

      const transactionId = await createTestTransaction({
        referralId: referral.id,
        buyerId: buyer.id,
        propertyId,
        sellerId: seller.id,
        closingDate: "2026-10-14",
        saleAmount: 100000,
      });

      await createTestCommission({
        transactionId,
        sellerId: seller.id,
        agreementId,
        saleAmount: 100000,
        createdAt: `${date}T10:00:00Z`,
      });
    }

    const response = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({
        dateFrom: "2026-10-12",
        dateTo: "2026-10-16",
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Commission Date Property 1");
    expect(response.text).not.toContain("Commission Date Property 0");
    expect(response.text).not.toContain("Commission Date Property 2");
  });

  it("returns a header-only CSV when no commissions match", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );

    const response = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({ status: "paid" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Commission ID");
    expect(response.text).not.toContain("Commission Export Property");
  });

  it("rejects unauthenticated and non-Finance Admin requests", async () => {
    const admin = await createTestUser("admin", "Commission Admin");
    const buyer = await createTestUser("buyer", "Commission Buyer");
    const agent = await createTestUser("agent", "Commission Agent");
    const developer = await createTestUser("developer", "Commission Developer");

    const unauthenticated = await request(app)
      .get("/api/v1/commissions/export");

    expect(unauthenticated.status).toBe(401);

    for (const user of [admin, buyer, agent, developer]) {
      const response = await request(app)
        .get("/api/v1/commissions/export")
        .set("Authorization", `Bearer ${user.token}`);

      expect(response.status).toBe(403);
    }
  });

  it("rejects invalid filters", async () => {
    const financeAdmin = await createTestUser(
      "finance_admin",
      "Commission Finance Admin",
    );

    const invalidStatus = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({ status: "invalid-status" });

    expect(invalidStatus.status).toBe(400);

    const invalidDateRange = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({
        dateFrom: "2026-10-20",
        dateTo: "2026-10-10",
      });

    expect(invalidDateRange.status).toBe(400);

    const invalidSellerId = await request(app)
      .get("/api/v1/commissions/export")
      .set("Authorization", `Bearer ${financeAdmin.token}`)
      .query({ sellerId: "not-a-uuid" });

    expect(invalidSellerId.status).toBe(400);
  });
});
