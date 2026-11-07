import "dotenv/config";

import express from "express";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { pool } from "../../src/config/database.ts";
import buyerProfileRoutes from "../../src/routes/buyerProfileRoutes";
import agentProfileRoutes from "../../src/routes/agentProfileRoutes";
import developerProfileRoutes from "../../src/routes/developerProfileRoutes";
import { signAccessToken } from "../../src/utils/jwt";

type TestRole = "buyer" | "agent" | "developer";

type TestStatus =
  "pending" | "approved" | "rejected" | "suspended" | "deactivated";

interface TestUser {
  id: string;
  email: string;
  role: TestRole;
  accessToken: string;
}

interface CreateTestUserOptions {
  status?: TestStatus;
  emailVerified?: boolean;
}

// --------------------------------------------------
// Test database safety
// --------------------------------------------------

const databaseUrl = process.env.DATABASE_URL;
const expectedTestHost = process.env.TEST_DATABASE_HOST;

if (!databaseUrl || !expectedTestHost) {
  throw new Error(
    "DATABASE_URL and TEST_DATABASE_HOST must be configured in .env.test",
  );
}

const actualDatabaseHost = new URL(databaseUrl).hostname;

if (actualDatabaseHost !== expectedTestHost) {
  throw new Error(
    "Refusing to run profile integration tests: DATABASE_URL does not match TEST_DATABASE_HOST.",
  );
}

// --------------------------------------------------
// Test application
// --------------------------------------------------

const app = express();

app.use(express.json());
app.use("/api/v1/buyer", buyerProfileRoutes);
app.use("/api/v1/agent", agentProfileRoutes);
app.use("/api/v1/developer", developerProfileRoutes);

// --------------------------------------------------
// Test data helpers
// --------------------------------------------------

const createdUserIds: string[] = [];

async function createTestUser(
  role: TestRole = "buyer",
  options: CreateTestUserOptions = {},
): Promise<TestUser> {
  const email = `profile-test-${crypto.randomUUID()}@example.test`;

  const status = options.status ?? "approved";
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
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      "Profile Integration Test User",
      email,
      "unused-test-password-hash",
      role,
      status,
      emailVerified ? new Date() : null,
    ],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create test user.");
  }

  createdUserIds.push(user.id);

  const accessToken = await signAccessToken({
    userId: user.id,
    role,
  });

  return {
    id: user.id,
    email,
    role,
    accessToken,
  };
}

async function insertBuyerProfile(
  userId: string,
  phoneNumber: string | null,
  preferredContactMethod: "email" | "phone" | "whatsapp" | null,
) {
  await pool.query(
    `INSERT INTO buyer_profiles (
       user_id,
       phone_number,
       preferred_contact_method
     )
     VALUES ($1, $2, $3)`,
    [userId, phoneNumber, preferredContactMethod],
  );
}

async function insertAgentProfile(userId: string) {
  await pool.query(
    `INSERT INTO agent_profiles (
       user_id,
       phone_number,
       agency_name,
       bio,
       years_of_experience
     )
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, "+251911123456", "Test Agency", "Experienced property agent", 5],
  );
}

async function insertDeveloperProfile(userId: string) {
  await pool.query(
    `INSERT INTO developer_profiles (
       user_id,
       company_name,
       company_description,
       contact_phone,
       business_address,
       website_url
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      "Test Development Ltd",
      "Property development company",
      "+251911123456",
      "Addis Ababa, Ethiopia",
      "https://example.com",
    ],
  );
}

// --------------------------------------------------
// Cleanup
// --------------------------------------------------

afterEach(async () => {
  if (createdUserIds.length === 0) {
    return;
  }

  await pool.query(
    `DELETE FROM users
     WHERE id = ANY($1::uuid[])`,
    [createdUserIds],
  );

  createdUserIds.length = 0;
});

afterAll(async () => {
  await pool.end();
});

// ==================================================
// BUYER PROFILE INTEGRATION TESTS
// ==================================================

describe("Buyer profile integration tests", () => {
  // ------------------------------------------------
  // GET /api/v1/buyer/me
  // ------------------------------------------------

  describe("GET /api/v1/buyer/me", () => {
    it("returns the authenticated buyer's profile", async () => {
      const buyer = await createTestUser();

      await insertBuyerProfile(buyer.id, "+251911123456", "whatsapp");

      const response = await request(app)
        .get("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        message: "Buyer profile retrieved successfully",
        data: {
          userId: buyer.id,
          phoneNumber: "+251911123456",
          preferredContactMethod: "whatsapp",
        },
      });

      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it("returns 404 when the buyer profile does not exist", async () => {
      const buyer = await createTestUser();

      const response = await request(app)
        .get("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`);

      expect(response.status).toBe(404);

      expect(response.body).toMatchObject({
        message: "Buyer profile not found",
        code: "BUYER_PROFILE_NOT_FOUND",
      });
    });
  });

  // ------------------------------------------------
  // PATCH /api/v1/buyer/me
  // ------------------------------------------------

  describe("PATCH /api/v1/buyer/me", () => {
    it("creates a buyer profile when one does not exist", async () => {
      const buyer = await createTestUser();

      const response = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`)
        .send({
          phoneNumber: "+251911123456",
          preferredContactMethod: "whatsapp",
        });

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        message: "Buyer profile saved successfully",
        data: {
          userId: buyer.id,
          phoneNumber: "+251911123456",
          preferredContactMethod: "whatsapp",
        },
      });

      const stored = await pool.query(
        `SELECT phone_number, preferred_contact_method
         FROM buyer_profiles
         WHERE user_id = $1`,
        [buyer.id],
      );

      expect(stored.rows[0]).toEqual({
        phone_number: "+251911123456",
        preferred_contact_method: "whatsapp",
      });
    });

    it("updates both profile fields", async () => {
      const buyer = await createTestUser();

      await insertBuyerProfile(buyer.id, "+251911111111", "email");

      const response = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`)
        .send({
          phoneNumber: "+251922222222",
          preferredContactMethod: "phone",
        });

      expect(response.status).toBe(200);

      expect(response.body.data).toMatchObject({
        phoneNumber: "+251922222222",
        preferredContactMethod: "phone",
      });
    });

    it("preserves omitted fields during a partial update", async () => {
      const buyer = await createTestUser();

      await insertBuyerProfile(buyer.id, "+251911111111", "whatsapp");

      const response = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`)
        .send({
          phoneNumber: "+251922222222",
        });

      expect(response.status).toBe(200);

      expect(response.body.data).toMatchObject({
        phoneNumber: "+251922222222",
        preferredContactMethod: "whatsapp",
      });

      const stored = await pool.query(
        `SELECT phone_number, preferred_contact_method
         FROM buyer_profiles
         WHERE user_id = $1`,
        [buyer.id],
      );

      expect(stored.rows[0].preferred_contact_method).toBe("whatsapp");
    });

    it("clears profile fields when null is explicitly provided", async () => {
      const buyer = await createTestUser();

      await insertBuyerProfile(buyer.id, "+251911123456", "phone");

      const response = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`)
        .send({
          phoneNumber: null,
          preferredContactMethod: null,
        });

      expect(response.status).toBe(200);

      expect(response.body.data).toMatchObject({
        userId: buyer.id,
        phoneNumber: null,
        preferredContactMethod: null,
      });

      const stored = await pool.query(
        `SELECT phone_number, preferred_contact_method
         FROM buyer_profiles
         WHERE user_id = $1`,
        [buyer.id],
      );

      expect(stored.rows[0]).toEqual({
        phone_number: null,
        preferred_contact_method: null,
      });
    });

    it.each([
      {
        description: "invalid phone number",
        body: { phoneNumber: "invalid-phone" },
      },
      {
        description: "invalid contact method",
        body: { preferredContactMethod: "telegram" },
      },
      {
        description: "empty request body",
        body: {},
      },
    ])("returns 400 for $description", async ({ body }) => {
      const buyer = await createTestUser();

      const response = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`)
        .send(body);

      expect(response.status).toBe(400);

      expect(response.body).toMatchObject({
        message: "Validation failed",
        code: "VALIDATION_ERROR",
      });

      expect(response.body.errors).toBeInstanceOf(Array);
    });

    it("rejects unknown fields such as buyerId", async () => {
      const buyer = await createTestUser();

      const response = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`)
        .send({
          buyerId: crypto.randomUUID(),
          phoneNumber: "+251911123456",
        });

      expect(response.status).toBe(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

  // ------------------------------------------------
  // Authentication and authorization
  // ------------------------------------------------

  describe("Authentication and authorization", () => {
    it("returns 401 when the access token is missing", async () => {
      const response = await request(app).get("/api/v1/buyer/me");

      expect(response.status).toBe(401);

      expect(response.body.message).toBe("Authentication required");
    });

    it("returns 401 when the access token is invalid", async () => {
      const response = await request(app)
        .get("/api/v1/buyer/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);

      expect(response.body.message).toBe("Invalid or expired access token");
    });

    it.each(["agent", "developer"] as const)(
      "returns 403 when a %s attempts to access buyer profile routes",
      async (role) => {
        const user = await createTestUser(role);

        const response = await request(app)
          .get("/api/v1/buyer/me")
          .set("Authorization", `Bearer ${user.accessToken}`);

        expect(response.status).toBe(403);

        expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
      },
    );

    it("returns 403 when the buyer's email is not verified", async () => {
      const buyer = await createTestUser("buyer", {
        emailVerified: false,
      });

      const response = await request(app)
        .get("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyer.accessToken}`);

      expect(response.status).toBe(403);

      expect(response.body).toMatchObject({
        message: "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
      });
    });

    it.each(["suspended", "deactivated"] as const)(
      "returns 403 when the buyer account is %s",
      async (status) => {
        const buyer = await createTestUser("buyer", {
          status,
        });

        const response = await request(app)
          .get("/api/v1/buyer/me")
          .set("Authorization", `Bearer ${buyer.accessToken}`);

        expect(response.status).toBe(403);

        expect(response.body).toMatchObject({
          message: "Your account is not active",
          code: "ACCOUNT_INACTIVE",
          status,
        });
      },
    );
  });

  // ------------------------------------------------
  // Buyer data isolation
  // ------------------------------------------------

  describe("Buyer data isolation", () => {
    it("only retrieves and updates the authenticated buyer's profile", async () => {
      const buyerOne = await createTestUser();
      const buyerTwo = await createTestUser();

      await insertBuyerProfile(buyerOne.id, "+251911111111", "email");

      await insertBuyerProfile(buyerTwo.id, "+251922222222", "whatsapp");

      // Buyer one can only retrieve their own profile.
      const getResponse = await request(app)
        .get("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyerOne.accessToken}`);

      expect(getResponse.status).toBe(200);

      expect(getResponse.body.data).toMatchObject({
        userId: buyerOne.id,
        phoneNumber: "+251911111111",
      });

      expect(getResponse.body.data.userId).not.toBe(buyerTwo.id);

      // Buyer one cannot provide buyerTwo's ID to modify their profile.
      const updateResponse = await request(app)
        .patch("/api/v1/buyer/me")
        .set("Authorization", `Bearer ${buyerOne.accessToken}`)
        .send({
          buyerId: buyerTwo.id,
          phoneNumber: "+251933333333",
        });

      expect(updateResponse.status).toBe(400);

      // Buyer two's profile must remain unchanged.
      const stored = await pool.query(
        `SELECT phone_number, preferred_contact_method
         FROM buyer_profiles
         WHERE user_id = $1`,
        [buyerTwo.id],
      );

      expect(stored.rows[0]).toEqual({
        phone_number: "+251922222222",
        preferred_contact_method: "whatsapp",
      });
    });
  });
});


describe("Agent profile integration tests", () => {
  describe("GET /api/v1/agent/me", () => {
    it("returns the authenticated agent's profile", async () => {
      const agent = await createTestUser("agent");
      await insertAgentProfile(agent.id);

      const response = await request(app)
        .get("/api/v1/agent/me")
        .set("Authorization", `Bearer ${agent.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({
        user_id: agent.id,
        phone_number: "+251911123456",
        agency_name: "Test Agency",
        bio: "Experienced property agent",
        years_of_experience: 5,
      });
    });

    it("returns null when the agent profile does not exist", async () => {
      const agent = await createTestUser("agent");

      const response = await request(app)
        .get("/api/v1/agent/me")
        .set("Authorization", `Bearer ${agent.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toBeNull();
    });
  });

  describe("PATCH /api/v1/agent/me", () => {
    it("creates an agent profile", async () => {
      const agent = await createTestUser("agent");

      const response = await request(app)
        .patch("/api/v1/agent/me")
        .set("Authorization", `Bearer ${agent.accessToken}`)
        .send({
          phone_number: "+251922222222",
          agency_name: "New Agency",
          bio: "Property specialist",
          years_of_experience: 4,
        });

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({
        user_id: agent.id,
        phone_number: "+251922222222",
        agency_name: "New Agency",
        bio: "Property specialist",
        years_of_experience: 4,
      });
    });

    it("updates agent profile fields", async () => {
      const agent = await createTestUser("agent");
      await insertAgentProfile(agent.id);

      const response = await request(app)
        .patch("/api/v1/agent/me")
        .set("Authorization", `Bearer ${agent.accessToken}`)
        .send({
          phone_number: "+251933333333",
          years_of_experience: 8,
        });

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({
        phone_number: "+251933333333",
        agency_name: "Test Agency",
        bio: "Experienced property agent",
        years_of_experience: 8,
      });
    });

    it("clears nullable fields when null is provided", async () => {
      const agent = await createTestUser("agent");
      await insertAgentProfile(agent.id);

      const response = await request(app)
        .patch("/api/v1/agent/me")
        .set("Authorization", `Bearer ${agent.accessToken}`)
        .send({
          phone_number: null,
          agency_name: null,
          bio: null,
          years_of_experience: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({
        phone_number: null,
        agency_name: null,
        bio: null,
        years_of_experience: null,
      });
    });

    it.each([
      {
        description: "empty body",
        body: {},
      },
      {
        description: "invalid phone number",
        body: { phone_number: "invalid-phone" },
      },
      {
        description: "negative experience",
        body: { years_of_experience: -1 },
      },
      {
        description: "decimal experience",
        body: { years_of_experience: 2.5 },
      },
      {
        description: "unknown field",
        body: { unknownField: "unexpected" },
      },
    ])("rejects $description", async ({ body }) => {
      const agent = await createTestUser("agent");

      const response = await request(app)
        .patch("/api/v1/agent/me")
        .set("Authorization", `Bearer ${agent.accessToken}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_PROFILE_DATA");
    });
  });

  describe("Authorization", () => {
    it.each(["buyer", "developer"] as const)(
      "rejects %s access to agent profile routes",
      async (role) => {
        const user = await createTestUser(role);

        const response = await request(app)
          .get("/api/v1/agent/me")
          .set("Authorization", `Bearer ${user.accessToken}`);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
      },
    );
  });
});


describe("Developer profile integration tests", () => {
  describe("GET /api/v1/developer/me", () => {
    it("returns the authenticated developer's profile", async () => {
      const developer = await createTestUser("developer");
      await insertDeveloperProfile(developer.id);

      const response = await request(app)
        .get("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({
        user_id: developer.id,
        company_name: "Test Development Ltd",
        company_description: "Property development company",
        contact_phone: "+251911123456",
        business_address: "Addis Ababa, Ethiopia",
        website_url: "https://example.com",
      });
    });

    it("returns null when the developer profile does not exist", async () => {
      const developer = await createTestUser("developer");

      const response = await request(app)
        .get("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toBeNull();
    });
  });

  describe("PATCH /api/v1/developer/me", () => {
    it("creates a developer profile with all required fields", async () => {
      const developer = await createTestUser("developer");

      const response = await request(app)
        .patch("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`)
        .send({
          company_name: "New Development Ltd",
          contact_phone: "+251922222222",
          business_address: "Bahir Dar, Ethiopia",
          company_description: "Residential development",
          website_url: "https://example.com",
        });

      expect(response.status).toBe(200);

      expect(response.body.profile).toMatchObject({
        user_id: developer.id,
        company_name: "New Development Ltd",
        contact_phone: "+251922222222",
        business_address: "Bahir Dar, Ethiopia",
        company_description: "Residential development",
        website_url: "https://example.com",
      });
    });

    it("returns missing required fields when creating an incomplete profile", async () => {
      const developer = await createTestUser("developer");

      const response = await request(app)
        .patch("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`)
        .send({
          company_description: "A development company",
        });

      expect(response.status).toBe(400);

      expect(response.body).toMatchObject({
        message: "Complete the required fields to create your profile",
        code: "PROFILE_FIELDS_REQUIRED",
        missingFields: [
          "company_name",
          "contact_phone",
          "business_address",
        ],
      });
    });

    it("preserves omitted fields during a partial update", async () => {
      const developer = await createTestUser("developer");
      await insertDeveloperProfile(developer.id);

      const response = await request(app)
        .patch("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`)
        .send({
          company_name: "Updated Development Ltd",
        });

      expect(response.status).toBe(200);

      expect(response.body.profile).toMatchObject({
        company_name: "Updated Development Ltd",
        company_description: "Property development company",
        contact_phone: "+251911123456",
        business_address: "Addis Ababa, Ethiopia",
        website_url: "https://example.com",
      });
    });

    it("clears nullable optional fields when null is provided", async () => {
      const developer = await createTestUser("developer");
      await insertDeveloperProfile(developer.id);

      const response = await request(app)
        .patch("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`)
        .send({
          company_description: null,
          website_url: null,
        });

      expect(response.status).toBe(200);

      expect(response.body.profile).toMatchObject({
        company_name: "Test Development Ltd",
        company_description: null,
        contact_phone: "+251911123456",
        business_address: "Addis Ababa, Ethiopia",
        website_url: null,
      });
    });

    it.each([
      {
        description: "empty body",
        body: {},
      },
      {
        description: "invalid phone number",
        body: { contact_phone: "invalid-phone" },
      },
      {
        description: "invalid website URL",
        body: { website_url: "not-a-url" },
      },
      {
        description: "empty company name",
        body: { company_name: "   " },
      },
      {
        description: "empty business address",
        body: { business_address: "   " },
      },
      {
        description: "null company name",
        body: { company_name: null },
      },
      {
        description: "unknown field",
        body: { unknownField: "unexpected" },
      },
    ])("rejects $description", async ({ body }) => {
      const developer = await createTestUser("developer");

      const response = await request(app)
        .patch("/api/v1/developer/me")
        .set("Authorization", `Bearer ${developer.accessToken}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_PROFILE_DATA");
    });
  });

  describe("Authorization", () => {
    it.each(["buyer", "agent"] as const)(
      "rejects %s access to developer profile routes",
      async (role) => {
        const user = await createTestUser(role);

        const response = await request(app)
          .get("/api/v1/developer/me")
          .set("Authorization", `Bearer ${user.accessToken}`);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
      },
    );
  });
});
