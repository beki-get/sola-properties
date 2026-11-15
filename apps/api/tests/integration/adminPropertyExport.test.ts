
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

type TestRole = Extract<AppRole, "admin" | "buyer" | "agent" | "developer" | "finance_admin">;

async function createTestUser(role: TestRole) {
  const email = `property-export-${randomUUID()}@example.test`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name, email, password_hash, role, status, email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, 'approved', NOW())
     RETURNING id`,
    ["Property Export Test", email, "test-only-password-hash", role],
  );

  const id = result.rows[0]?.id;

  if (!id) throw new Error("Could not create property-export test user.");

  testUserIds.push(id);

  return {
    id,
    email,
    token: await signAccessToken({ userId: id, role }),
  };
}

async function createTestCategory() {
  const name = `Test Category ${randomUUID()}`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_categories (name)
     VALUES ($1)
     RETURNING id`,
    [name],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test property category.");

  testCategoryIds.push(id);
  return { id, name };
}

async function createTestLocation() {
  const name = `Test Location ${randomUUID()}`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_locations (name)
     VALUES ($1)
     RETURNING id`,
    [name],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test property location.");

  testLocationIds.push(id);
  return { id, name };
}

async function createTestProperty(
  ownerId: string,
  categoryId: string,
  locationId: string,
  options: {
    title?: string;
    status?: "draft" | "pending_approval" | "active" | "inactive" | "sold" | "rejected";
  } = {},
) {
  const title = options.title ?? `Test Property ${randomUUID()}`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO properties (
       owner_id,
       title,
       property_type,
       location,
       category_id,
       location_id,
       size_sqm,
       bedrooms,
       bathrooms,
       features,
       price,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 120, 3, 2,
             ARRAY['parking', 'balcony'], 2500000,
             $7::property_status)
     RETURNING id`,
    [
      ownerId,
      title,
      "Residential",
      "Test City",
      categoryId,
      locationId,
      options.status ?? "draft",
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Could not create test property.");

  testPropertyIds.push(id);
  return { id, title };
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
  if (testPropertyIds.length > 0) {
    await pool.query(
      "DELETE FROM properties WHERE id = ANY($1::uuid[])",
      [testPropertyIds],
    );
    testPropertyIds.splice(0);
  }

  if (testCategoryIds.length > 0) {
    await pool.query(
      "DELETE FROM property_categories WHERE id = ANY($1::uuid[])",
      [testCategoryIds],
    );
    testCategoryIds.splice(0);
  }

  if (testLocationIds.length > 0) {
    await pool.query(
      "DELETE FROM property_locations WHERE id = ANY($1::uuid[])",
      [testLocationIds],
    );
    testLocationIds.splice(0);
  }

  if (testUserIds.length > 0) {
    const userIds = [...testUserIds];

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

    testUserIds.splice(0);
  }
});

afterAll(async () => {
  await pool.end();
});

describe("admin property management and CSV export", () => {
  it("returns properties across all statuses", async () => {
    const admin = await createTestUser("admin");
    const owner = await createTestUser("agent");
    const category = await createTestCategory();
    const location = await createTestLocation();

    const draft = await createTestProperty(
      owner.id, category.id, location.id, { status: "draft" },
    );
    const pending = await createTestProperty(
      owner.id, category.id, location.id, { status: "pending_approval" },
    );
    const active = await createTestProperty(
      owner.id, category.id, location.id, { status: "active" },
    );

    const response = await request(app)
      .get("/api/v1/admin/properties/all")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);

    const returnedIds = response.body.items.map(
      (property: { id: string }) => property.id,
    );

    expect(returnedIds).toContain(draft.id);
    expect(returnedIds).toContain(pending.id);
    expect(returnedIds).toContain(active.id);
  });

  it("filters the all-properties list by status", async () => {
    const admin = await createTestUser("admin");
    const owner = await createTestUser("agent");
    const category = await createTestCategory();
    const location = await createTestLocation();

    const active = await createTestProperty(
      owner.id, category.id, location.id, { status: "active" },
    );
    const draft = await createTestProperty(
      owner.id, category.id, location.id, { status: "draft" },
    );

    const response = await request(app)
      .get("/api/v1/admin/properties/all?status=active")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);

    const returnedIds = response.body.items.map(
      (property: { id: string }) => property.id,
    );

    expect(returnedIds).toContain(active.id);
    expect(returnedIds).not.toContain(draft.id);
  });

  it("searches properties by title", async () => {
    const admin = await createTestUser("admin");
    const owner = await createTestUser("agent");
    const category = await createTestCategory();
    const location = await createTestLocation();

    const matching = await createTestProperty(
      owner.id, category.id, location.id,
      { title: "Unique Admin Search Property" },
    );
    const other = await createTestProperty(
      owner.id, category.id, location.id,
      { title: "Another Property" },
    );

    const response = await request(app)
      .get("/api/v1/admin/properties/all?q=Unique%20Admin%20Search")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);

    const returnedIds = response.body.items.map(
      (property: { id: string }) => property.id,
    );

    expect(returnedIds).toContain(matching.id);
    expect(returnedIds).not.toContain(other.id);
  });

  it("allows admins to download all properties as CSV", async () => {
    const admin = await createTestUser("admin");
    const owner = await createTestUser("agent");
    const category = await createTestCategory();
    const location = await createTestLocation();

    const property = await createTestProperty(
      owner.id, category.id, location.id,
      { title: "CSV Export Property" },
    );

    const response = await request(app)
      .get("/api/v1/admin/properties/all/export")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      'filename="sola-properties.csv"',
    );

    expect(response.text).toContain("Property ID");
    expect(response.text).toContain("Owner ID");
    expect(response.text).toContain("Category");
    expect(response.text).toContain("Location");
    expect(response.text).toContain(property.id);
    expect(response.text).toContain("CSV Export Property");
    expect(response.text).toContain(category.name);
    expect(response.text).toContain(location.name);
  });

  it("applies filters to the CSV export", async () => {
    const admin = await createTestUser("admin");
    const owner = await createTestUser("agent");
    const category = await createTestCategory();
    const location = await createTestLocation();

    const active = await createTestProperty(
      owner.id, category.id, location.id,
      { title: "Active Export Match", status: "active" },
    );
    const draft = await createTestProperty(
      owner.id, category.id, location.id,
      { title: "Draft Export Nonmatch", status: "draft" },
    );

    const response = await request(app)
      .get("/api/v1/admin/properties/all/export?status=active")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(active.id);
    expect(response.text).not.toContain(draft.id);
  });

  it("returns CSV headers when no properties match", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get("/api/v1/admin/properties/all/export?q=no-property-with-this-title")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("Property ID");
    expect(response.text).not.toContain("Test Property");
  });

  it("does not export rejection reasons", async () => {
    const admin = await createTestUser("admin");
    const owner = await createTestUser("agent");
    const category = await createTestCategory();
    const location = await createTestLocation();

    const property = await createTestProperty(
      owner.id, category.id, location.id,
      { status: "rejected" },
    );

    await pool.query(
      "UPDATE properties SET rejection_reason = $1 WHERE id = $2",
      ["Internal review note", property.id],
    );

    const response = await request(app)
      .get("/api/v1/admin/properties/all/export")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("Internal review note");
    expect(response.text).not.toContain("rejection_reason");
  });

  it("rejects non-admin users from both endpoints", async () => {
    const buyer = await createTestUser("buyer");

    const listResponse = await request(app)
      .get("/api/v1/admin/properties/all")
      .set("Authorization", `Bearer ${buyer.token}`);

    const exportResponse = await request(app)
      .get("/api/v1/admin/properties/all/export")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(listResponse.status).toBe(403);
    expect(exportResponse.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    const listResponse = await request(app).get(
      "/api/v1/admin/properties/all",
    );

    const exportResponse = await request(app).get(
      "/api/v1/admin/properties/all/export",
    );

    expect(listResponse.status).toBe(401);
    expect(exportResponse.status).toBe(401);
  });

  it("rejects invalid filters", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get("/api/v1/admin/properties/all?status=invalid")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid date range", async () => {
    const admin = await createTestUser("admin");

    const response = await request(app)
      .get(
        "/api/v1/admin/properties/all/export?dateFrom=2026-05-20&dateTo=2026-05-10",
      )
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
