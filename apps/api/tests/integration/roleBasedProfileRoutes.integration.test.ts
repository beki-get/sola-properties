import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import type { AppRole } from "../../src/queries/authQueries";
import { pool } from "../../src/config/database";
import {
  getAgentProfile,
  updateAgentProfile,
} from "../../src/services/agentProfileService";
import { updateBuyerProfile } from "../../src/services/buyerProfileService";
import {
  getDeveloperProfile,
  updateDeveloperProfile,
} from "../../src/services/developerProfileService";
import app from "../../src/app";
import { signAccessToken } from "../../src/utils/jwt";

vi.mock("../../src/services/agentProfileService", () => ({
  getAgentProfile: vi.fn(),
  updateAgentProfile: vi.fn(),
}));

vi.mock("../../src/services/buyerProfileService", () => ({
  updateBuyerProfile: vi.fn(),
}));

vi.mock("../../src/services/developerProfileService", () => ({
  getDeveloperProfile: vi.fn(),
  updateDeveloperProfile: vi.fn(),
}));

const mockedGetAgentProfile = vi.mocked(getAgentProfile);
const mockedUpdateAgentProfile = vi.mocked(updateAgentProfile);
const mockedUpdateBuyerProfile = vi.mocked(updateBuyerProfile);
const mockedGetDeveloperProfile = vi.mocked(getDeveloperProfile);
const mockedUpdateDeveloperProfile = vi.mocked(updateDeveloperProfile);
const testUserIds: string[] = [];

type ProfileRole = Extract<AppRole, "buyer" | "agent" | "developer">;

async function createProfileUser(role: ProfileRole) {
  const email = `profile-test-${randomUUID()}@example.test`;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, 'approved'::account_status, NOW())
     RETURNING id`,
    ["Profile Integration Test User", email, "test-only-hash", role],
  );
  const userId = result.rows[0]?.id;

  if (!userId) {
    throw new Error("Could not create profile integration test user.");
  }

  testUserIds.push(userId);
  return { id: userId, token: await signAccessToken({ userId, role }) };
}

afterEach(async () => {
  const userIds = testUserIds.splice(0);
  if (userIds.length > 0) {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
  }
});

afterAll(async () => {
  await pool.end();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("role-based profile routes", () => {
  it("allows an agent to update/read their profile and blocks other roles", async () => {
    const agent = await createProfileUser("agent");
    const buyer = await createProfileUser("buyer");
    const profile = {
      user_id: agent.id,
      phone_number: null,
      agency_name: "North Realty",
      bio: null,
      years_of_experience: 4,
    };
    mockedUpdateAgentProfile.mockResolvedValue(profile as never);
    mockedGetAgentProfile.mockResolvedValue(profile as never);

    const update = await request(app)
      .patch("/api/v1/agent/me")
      .set("Authorization", `Bearer ${agent.token}`)
      .send({ agency_name: "North Realty", years_of_experience: 4 });

    expect(update.status).toBe(200);
    expect(mockedUpdateAgentProfile).toHaveBeenCalledWith(agent.id, {
      agency_name: "North Realty",
      years_of_experience: 4,
    });

    const read = await request(app)
      .get("/api/v1/agent/me")
      .set("Authorization", `Bearer ${agent.token}`);
    expect(read.status).toBe(200);
    expect(read.body.profile.agency_name).toBe("North Realty");

    const wrongRole = await request(app)
      .get("/api/v1/agent/me")
      .set("Authorization", `Bearer ${buyer.token}`);
    expect(wrongRole.status).toBe(403);
    expect(wrongRole.body.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("validates buyer contact preferences and saves valid updates", async () => {
    const buyer = await createProfileUser("buyer");
    mockedUpdateBuyerProfile.mockResolvedValue({
      userId: buyer.id,
      phoneNumber: "+251900123456",
      preferredContactMethod: "whatsapp",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const update = await request(app)
      .patch("/api/v1/buyer/me")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({
        phoneNumber: "+251900123456",
        preferredContactMethod: "whatsapp",
      });

    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({
      userId: buyer.id,
      phoneNumber: "+251900123456",
      preferredContactMethod: "whatsapp",
    });

    const invalid = await request(app)
      .patch("/api/v1/buyer/me")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ preferredContactMethod: "telegram" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");
    expect(mockedUpdateBuyerProfile).toHaveBeenCalledOnce();
  });

  it("returns developer-profile required fields and accepts a complete profile", async () => {
    const developer = await createProfileUser("developer");
    mockedUpdateDeveloperProfile
      .mockResolvedValueOnce({
        success: false,
        missingFields: ["contact_phone", "business_address"],
      })
      .mockResolvedValueOnce({
        success: true,
        profile: {
          user_id: developer.id,
          company_name: "Aster Development",
          company_description: null,
          contact_phone: "+251900123456",
          business_address: "2 Developer Road, Addis Ababa",
          website_url: null,
        },
      } as never);
    mockedGetDeveloperProfile.mockResolvedValue(null);

    const incomplete = await request(app)
      .patch("/api/v1/developer/me")
      .set("Authorization", `Bearer ${developer.token}`)
      .send({ company_name: "Aster Development" });

    expect(incomplete.status).toBe(400);
    expect(incomplete.body.code).toBe("PROFILE_FIELDS_REQUIRED");
    expect(incomplete.body.missingFields).toEqual([
      "contact_phone",
      "business_address",
    ]);

    const complete = await request(app)
      .patch("/api/v1/developer/me")
      .set("Authorization", `Bearer ${developer.token}`)
      .send({
        company_name: "Aster Development",
        contact_phone: "+251900123456",
        business_address: "2 Developer Road, Addis Ababa",
      });

    expect(complete.status).toBe(200);
    expect(complete.body.profile.company_name).toBe("Aster Development");
    expect(mockedUpdateDeveloperProfile).toHaveBeenCalledTimes(2);
  });
});
