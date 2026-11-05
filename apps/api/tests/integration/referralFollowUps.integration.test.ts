import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ReferralError } from "../../src/queries/referralQueries";

const { mockCreateReferralFollowUp, mockGetReferralFollowUps } = vi.hoisted(
  () => ({
    mockCreateReferralFollowUp: vi.fn(),
    mockGetReferralFollowUps: vi.fn(),
  }),
);

let currentUser: {
  id: string;
  fullName: string;
  email: string;
  role: "buyer" | "agent" | "developer" | "admin";
  status: "approved";
  emailVerified: boolean;
} | null = {
  id: "agent-123",
  fullName: "Assigned Agent",
  email: "agent@example.com",
  role: "agent",
  status: "approved",
  emailVerified: true,
};

vi.mock("../../src/services/referralService", () => ({
  createReferralFollowUpService: mockCreateReferralFollowUp,
  getReferralFollowUpsService: mockGetReferralFollowUps,
}));

vi.mock("../../src/middlewares/authenticate", () => ({
  authenticate: (req: any, res: any, next: () => void) => {
    if (!currentUser) {
      res.status(401).json({
        message: "Unauthorized",
        code: "UNAUTHENTICATED",
      });
      return;
    }

    req.currentUser = currentUser;
    req.log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
    };
    next();
  },
}));

vi.mock("../../src/middlewares/requireApprovedAccount", () => ({
  requireApprovedAccount: (_req: any, _res: any, next: () => void) => {
    next();
  },
}));

vi.mock("../../src/middlewares/authorizeRoles", () => ({
  authorizeRoles: (...allowedRoles: string[]) => {
    return (req: any, res: any, next: () => void) => {
      if (!req.currentUser || !allowedRoles.includes(req.currentUser.role)) {
        res.status(403).json({
          message: "You do not have permission to access this resource",
          code: "ROLE_NOT_ALLOWED",
        });
        return;
      }

      next();
    };
  },
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

import referralRoutes from "../../src/routes/referralRoutes";

const app = express();
app.use(express.json());
app.use("/api/v1/referrals", referralRoutes);

const referralId = "11111111-1111-4111-8111-111111111111";

describe("Referral follow-up routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = {
      id: "agent-123",
      fullName: "Assigned Agent",
      email: "agent@example.com",
      role: "agent",
      status: "approved",
      emailVerified: true,
    };
  });

  it("records a follow-up on an accepted referral by the assigned agent", async () => {
    const followUp = {
      id: "fu-001",
      referral_id: referralId,
      sender_id: "agent-123",
      kind: "follow_up",
      body: "Buyer accepted the referral and is moving forward.",
      due_at: "2026-11-10T12:00:00.000Z",
      created_at: "2026-11-03T12:00:00.000Z",
    };

    mockCreateReferralFollowUp.mockResolvedValueOnce(followUp as never);

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({
        body: "Buyer accepted the referral and is moving forward.",
        dueAt: "2026-11-10T12:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Follow-up recorded successfully");
    expect(mockCreateReferralFollowUp).toHaveBeenCalledWith({
      referralId,
      senderId: "agent-123",
      body: "Buyer accepted the referral and is moving forward.",
      dueAt: "2026-11-10T12:00:00.000Z",
    });
  });

  it("records a follow-up on an in-progress referral by the assigned developer", async () => {
    currentUser = {
      ...currentUser!,
      id: "developer-456",
      fullName: "Assigned Developer",
      email: "developer@example.com",
      role: "developer",
    };

    const followUp = {
      id: "fu-002",
      referral_id: referralId,
      sender_id: "developer-456",
      kind: "follow_up",
      body: "Developer is preparing next steps for the buyer.",
      created_at: "2026-11-03T12:15:00.000Z",
    };

    mockCreateReferralFollowUp.mockResolvedValueOnce(followUp as never);

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({
        body: "Developer is preparing next steps for the buyer.",
      });

    expect(response.status).toBe(201);
    expect(mockCreateReferralFollowUp).toHaveBeenCalledWith({
      referralId,
      senderId: "developer-456",
      body: "Developer is preparing next steps for the buyer.",
      dueAt: undefined,
    });
  });

  it("records a follow-up on an agreement referral by the assigned agent", async () => {
    currentUser = {
      ...currentUser!,
      id: "agent-987",
      fullName: "Agreement Agent",
      email: "agreement-agent@example.com",
      role: "agent",
    };

    const followUp = {
      id: "fu-003",
      referral_id: referralId,
      sender_id: "agent-987",
      kind: "follow_up",
      body: "The agreement stage is underway and documents are being prepared.",
      created_at: "2026-11-03T12:30:00.000Z",
    };

    mockCreateReferralFollowUp.mockResolvedValueOnce(followUp as never);

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({
        body: "The agreement stage is underway and documents are being prepared.",
      });

    expect(response.status).toBe(201);
    expect(response.body.followUp.body).toBe(
      "The agreement stage is underway and documents are being prepared.",
    );
  });

  it("returns 403 when a non-assigned agent or developer tries to record a follow-up", async () => {
    currentUser = {
      ...currentUser!,
      id: "agent-999",
      fullName: "Unassigned Agent",
      email: "unassigned@example.com",
      role: "agent",
    };

    mockCreateReferralFollowUp.mockRejectedValueOnce(
      new ReferralError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "You are not assigned to this referral",
      ),
    );

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({ body: "Attempting to add a follow-up" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("REFERRAL_NOT_ASSIGNED");
  });

  it("returns 409 when the referral is assigned but not yet accepted", async () => {
    mockCreateReferralFollowUp.mockRejectedValueOnce(
      new ReferralError(
        409,
        "REFERRAL_NOT_OPEN",
        "Follow-ups are only allowed after a referral is accepted and before it is closed",
      ),
    );

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({ body: "This should fail before acceptance" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("REFERRAL_NOT_OPEN");
  });

  it("returns 409 when the referral is rejected or already closed", async () => {
    mockCreateReferralFollowUp.mockRejectedValueOnce(
      new ReferralError(
        409,
        "REFERRAL_NOT_OPEN",
        "Follow-ups are only allowed after a referral is accepted and before it is closed",
      ),
    );

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({ body: "This referral is no longer active" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("REFERRAL_NOT_OPEN");
  });

  it("returns 404 when the referral does not exist", async () => {
    mockCreateReferralFollowUp.mockRejectedValueOnce(
      new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found"),
    );

    const missingReferralId = "22222222-2222-4222-8222-222222222222";

    const response = await request(app)
      .post(`/api/v1/referrals/${missingReferralId}/follow-ups`)
      .send({ body: "This referral does not exist" });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("REFERRAL_NOT_FOUND");
  });

  it("returns 403 when an admin tries to create a follow-up", async () => {
    currentUser = {
      ...currentUser!,
      id: "admin-1",
      fullName: "Platform Admin",
      email: "admin@example.com",
      role: "admin",
    };

    const response = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({ body: "Admin should not be allowed to add follow-up" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("retrieves follow-up history for an admin", async () => {
    currentUser = {
      ...currentUser!,
      id: "admin-1",
      fullName: "Platform Admin",
      email: "admin@example.com",
      role: "admin",
    };

    const result = {
      followUps: [
        {
          id: "fu-100",
          referral_id: referralId,
          sender_id: "agent-123",
          sender_name: "Assigned Agent",
          body: "Follow-up from the agent",
          created_at: "2026-11-03T12:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    mockGetReferralFollowUps.mockResolvedValueOnce(result as never);

    const response = await request(app)
      .get(`/api/v1/referrals/${referralId}/follow-ups`)
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.followUps).toHaveLength(1);
    expect(mockGetReferralFollowUps).toHaveBeenCalledWith({
      referralId,
      userId: "admin-1",
      isAdmin: true,
      page: 1,
      limit: 10,
    });
  });

  it("returns 403 when a buyer tries to access either follow-up endpoint", async () => {
    currentUser = {
      id: "buyer-42",
      fullName: "Buyer User",
      email: "buyer@example.com",
      role: "buyer",
      status: "approved",
      emailVerified: true,
    };

    const postResponse = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({ body: "Buyer follow-up attempt" });

    const getResponse = await request(app)
      .get(`/api/v1/referrals/${referralId}/follow-ups`)
      .query({ page: 1, limit: 10 });

    expect(postResponse.status).toBe(403);
    expect(getResponse.status).toBe(403);
    expect(postResponse.body.code).toBe("ROLE_NOT_ALLOWED");
    expect(getResponse.body.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("returns 401 when an unauthenticated user tries either follow-up endpoint", async () => {
    currentUser = null;

    const postResponse = await request(app)
      .post(`/api/v1/referrals/${referralId}/follow-ups`)
      .send({ body: "Unauthenticated follow-up" });

    const getResponse = await request(app)
      .get(`/api/v1/referrals/${referralId}/follow-ups`)
      .query({ page: 1, limit: 10 });

    expect(postResponse.status).toBe(401);
    expect(getResponse.status).toBe(401);
    expect(postResponse.body.code).toBe("UNAUTHENTICATED");
    expect(getResponse.body.code).toBe("UNAUTHENTICATED");
  });
});
