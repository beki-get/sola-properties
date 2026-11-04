import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ReferralError } from "../../src/queries/referralQueries";

type TestRole = "buyer" | "agent" | "developer" | "admin";

type TestCurrentUser = {
  id: string;
  fullName: string;
  email: string;
  role: TestRole;
  status: "approved";
  emailVerified: boolean;
};

const {
  mockCreateReferral,
  mockGetMyReferrals,
  mockRespondToReferral,
  mockUpdateReferralStatus,
  mockReassignReferralService,
  mockGetAllReferralsService,
  mockGetReferralDetailsService,
  mockGetReferralHistoryService,
  mockGetBuyerReferralsService,
} = vi.hoisted(() => ({
  mockCreateReferral: vi.fn(),
  mockGetMyReferrals: vi.fn(),
  mockRespondToReferral: vi.fn(),
  mockUpdateReferralStatus: vi.fn(),
  mockReassignReferralService: vi.fn(),
  mockGetAllReferralsService: vi.fn(),
  mockGetReferralDetailsService: vi.fn(),
  mockGetReferralHistoryService: vi.fn(),
  mockGetBuyerReferralsService: vi.fn(),
}));

let currentUser: TestCurrentUser = {
  id: "buyer-123",
  fullName: "Buyer Test User",
  email: "buyer@example.com",
  role: "buyer",
  status: "approved",
  emailVerified: true,
};

vi.mock("../../src/services/referralService", () => ({
  createReferral: mockCreateReferral,
  getMyReferrals: mockGetMyReferrals,
  respondToReferral: mockRespondToReferral,
  updateReferralStatus: mockUpdateReferralStatus,
  reassignReferralService: mockReassignReferralService,
  getAllReferralsService: mockGetAllReferralsService,
  getReferralDetailsService: mockGetReferralDetailsService,
  getReferralHistoryService: mockGetReferralHistoryService,
  getBuyerReferralsService: mockGetBuyerReferralsService,
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

import {
  createReferral,
  getAllReferralsService,
  getBuyerReferralsService,
  getMyReferrals,
  getReferralDetailsService,
  getReferralHistoryService,
  reassignReferralService,
  respondToReferral,
  updateReferralStatus,
} from "../../src/services/referralService";
import referralRoutes from "../../src/routes/referralRoutes";

const app = express();
app.use(express.json());
app.use("/api/v1/referrals", referralRoutes);

describe("Referral routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = {
      id: "buyer-123",
      fullName: "Buyer Test User",
      email: "buyer@example.com",
      role: "buyer",
      status: "approved",
      emailVerified: true,
    };
  });

  it("creates a referral for a buyer", async () => {
    const referral = {
      id: "ref-001",
      reference_code: "REF-1000",
      buyer_id: "buyer-123",
      property_id: "11111111-1111-4111-8111-111111111111",
      assigned_to: "agent-456",
      message: "I am interested in this property.",
      status: "assigned",
    };

    mockCreateReferral.mockResolvedValueOnce(referral as never);

    const response = await request(app).post("/api/v1/referrals").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
      message: "I am interested in this property.",
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Inquiry submitted successfully.");
    expect(mockCreateReferral).toHaveBeenCalledWith({
      buyerId: "buyer-123",
      propertyId: "11111111-1111-4111-8111-111111111111",
      message: "I am interested in this property.",
    });
  });

  it("rejects invalid referral creation payloads", async () => {
    const response = await request(app).post("/api/v1/referrals").send({
      propertyId: "not-a-uuid",
      message: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID REFERRAL INPUT");
  });

  it("returns 404 when the property for a referral does not exist", async () => {
    mockCreateReferral.mockRejectedValueOnce(
      new ReferralError(404, "PROPERTY_NOT_FOUND", "Property not found."),
    );

    const response = await request(app).post("/api/v1/referrals").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
      message: "Interested in this property",
    });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("PROPERTY_NOT_FOUND");
  });

  it("returns 409 when the property is not active for referral creation", async () => {
    mockCreateReferral.mockRejectedValueOnce(
      new ReferralError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Inquiries can only be created for active properties.",
      ),
    );

    const response = await request(app).post("/api/v1/referrals").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
      message: "Interested in this property",
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROPERTY_NOT_ACTIVE");
  });

  it("returns 409 when a buyer already has an open referral for the same property", async () => {
    mockCreateReferral.mockRejectedValueOnce(
      new ReferralError(
        409,
        "DUPLICATE_ACTIVE_REFERRAL",
        "You already have an open referral for this property.",
      ),
    );

    const response = await request(app).post("/api/v1/referrals").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
      message: "Interested in this property",
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DUPLICATE_ACTIVE_REFERRAL");
  });

  it("forbids non-buyers from creating referrals", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      role: "agent",
    };

    const response = await request(app).post("/api/v1/referrals").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
      message: "Interested in this property",
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("returns the buyer's own referrals", async () => {
    const result = [
      {
        id: "ref-001",
        reference_code: "REF-1000",
        property_id: "11111111-1111-4111-8111-111111111111",
        status: "assigned",
      },
    ];

    mockGetBuyerReferralsService.mockResolvedValueOnce(result as never);

    const response = await request(app).get("/api/v1/referrals/buyer/me");

    expect(response.status).toBe(200);
    expect(response.body.referrals).toHaveLength(1);
    expect(mockGetBuyerReferralsService).toHaveBeenCalledWith("buyer-123");
  });

  it("returns assigned referrals for an agent", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    const referrals = [
      {
        id: "ref-002",
        reference_code: "REF-1001",
        buyer_id: "buyer-123",
        property_id: "11111111-1111-4111-8111-111111111112",
        status: "assigned",
      },
    ];

    mockGetMyReferrals.mockResolvedValueOnce(referrals as never);

    const response = await request(app).get("/api/v1/referrals/me");

    expect(response.status).toBe(200);
    expect(response.body.referrals).toHaveLength(1);
    expect(mockGetMyReferrals).toHaveBeenCalledWith("agent-456");
  });

  it("validates a referral decision payload before proceeding", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    const response = await request(app)
      .patch("/api/v1/referrals/ref-002/decision")
      .send({ decision: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID REFERRAL DECISION");
  });

  it("returns 404 when the referral is missing during a decision", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    mockRespondToReferral.mockRejectedValueOnce(
      new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found."),
    );

    const response = await request(app)
      .patch("/api/v1/referrals/ref-999/decision")
      .send({ decision: "accepted" });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("REFERRAL_NOT_FOUND");
  });

  it("returns 403 when a referral is not assigned to the current actor", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    mockRespondToReferral.mockRejectedValueOnce(
      new ReferralError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "This referral is not assigned to you.",
      ),
    );

    const response = await request(app)
      .patch("/api/v1/referrals/ref-002/decision")
      .send({ decision: "accepted" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("REFERRAL_NOT_ASSIGNED");
  });

  it("accepts or rejects a referral assignment", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    const referral = {
      id: "ref-002",
      reference_code: "REF-1001",
      status: "accepted",
      assigned_to: "agent-456",
    };

    mockRespondToReferral.mockResolvedValueOnce(referral as never);

    const response = await request(app)
      .patch("/api/v1/referrals/ref-002/decision")
      .send({ decision: "accepted" });

    expect(response.status).toBe(200);
    expect(response.body.referral.status).toBe("accepted");
    expect(mockRespondToReferral).toHaveBeenCalledWith({
      referralId: "ref-002",
      actorId: "agent-456",
      decision: "accepted",
    });
  });

  it("returns 409 when a referral status transition is invalid", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    mockUpdateReferralStatus.mockRejectedValueOnce(
      new ReferralError(
        409,
        "INVALID_REFERRAL_TRANSITION",
        "Only assigned referrals can be accepted or rejected.",
      ),
    );

    const response = await request(app)
      .patch("/api/v1/referrals/ref-002/status")
      .send({ status: "closed_won" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INVALID_REFERRAL_TRANSITION");
  });

  it("updates a referral status", async () => {
    currentUser = {
      ...currentUser,
      id: "agent-456",
      fullName: "Agent Test User",
      email: "agent@example.com",
      role: "agent",
    };

    const referral = {
      id: "ref-002",
      reference_code: "REF-1001",
      status: "in_progress",
    };

    mockUpdateReferralStatus.mockResolvedValueOnce(referral as never);

    const response = await request(app)
      .patch("/api/v1/referrals/ref-002/status")
      .send({ status: "in_progress" });

    expect(response.status).toBe(200);
    expect(response.body.referral.status).toBe("in_progress");
    expect(mockUpdateReferralStatus).toHaveBeenCalledWith({
      referralId: "ref-002",
      actorId: "agent-456",
      status: "in_progress",
    });
  });

  it("denies non-agent or non-developer access to decision and status actions", async () => {
    currentUser = {
      ...currentUser,
      id: "buyer-123",
      role: "buyer",
    };

    const decisionResponse = await request(app)
      .patch("/api/v1/referrals/ref-002/decision")
      .send({ decision: "accepted" });

    const statusResponse = await request(app)
      .patch("/api/v1/referrals/ref-002/status")
      .send({ status: "in_progress" });

    expect(decisionResponse.status).toBe(403);
    expect(statusResponse.status).toBe(403);
    expect(decisionResponse.body.code).toBe("ROLE_NOT_ALLOWED");
    expect(statusResponse.body.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("rejects unauthenticated access to referral routes", async () => {
    currentUser = undefined as any;

    const response = await request(app).get("/api/v1/referrals/buyer/me");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("allows an admin to list referrals with a status filter", async () => {
    currentUser = {
      ...currentUser,
      id: "admin-1",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin",
    };

    const referrals = [{ id: "ref-003", status: "assigned" }];
    mockGetAllReferralsService.mockResolvedValueOnce(referrals as never);

    const response = await request(app).get(
      "/api/v1/referrals/admin?status=assigned",
    );

    expect(response.status).toBe(200);
    expect(response.body.referrals).toHaveLength(1);
    expect(mockGetAllReferralsService).toHaveBeenCalledWith("assigned");
  });

  it("returns referral details for an admin", async () => {
    currentUser = {
      ...currentUser,
      id: "admin-1",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin",
    };

    const referral = {
      id: "ref-003",
      reference_code: "REF-1002",
      status: "assigned",
    };

    mockGetReferralDetailsService.mockResolvedValueOnce(referral as never);

    const response = await request(app).get("/api/v1/referrals/admin/ref-003");

    expect(response.status).toBe(200);
    expect(response.body.referral.id).toBe("ref-003");
    expect(mockGetReferralDetailsService).toHaveBeenCalledWith("ref-003");
  });

  it("returns referral history for an admin", async () => {
    currentUser = {
      ...currentUser,
      id: "admin-1",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin",
    };

    const history = [
      { id: "event-1", event_type: "created", status: "assigned" },
    ];
    mockGetReferralHistoryService.mockResolvedValueOnce(history as never);

    const response = await request(app).get(
      "/api/v1/referrals/admin/ref-003/history",
    );

    expect(response.status).toBe(200);
    expect(response.body.history).toHaveLength(1);
    expect(mockGetReferralHistoryService).toHaveBeenCalledWith("ref-003");
  });

  it("reassigns a referral to another agent or developer", async () => {
    currentUser = {
      ...currentUser,
      id: "admin-1",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin",
    };

    const referral = {
      id: "ref-003",
      reference_code: "REF-1002",
      assigned_to: "11111111-1111-4111-8111-111111111113",
    };

    mockReassignReferralService.mockResolvedValueOnce(referral as never);

    const response = await request(app)
      .patch("/api/v1/referrals/admin/ref-003/reassign")
      .send({
        newAssigneeId: "11111111-1111-4111-8111-111111111113",
        reason: "Escalated to another agent",
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Referral reassigned successfully.");
    expect(mockReassignReferralService).toHaveBeenCalledWith({
      referralId: "ref-003",
      actorId: "admin-1",
      newAssigneeId: "11111111-1111-4111-8111-111111111113",
      reason: "Escalated to another agent",
    });
  });
});
