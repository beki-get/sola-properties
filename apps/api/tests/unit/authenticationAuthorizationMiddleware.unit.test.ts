/*
This test file covers invalid credentials, deleted users, 
email verification, account statuses, current database roles,
 account approval, and role restrictions.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

import { authenticate } from "../../src/middlewares/authenticate";
import { requireApprovedAccount } from "../../src/middlewares/requireApprovedAccount";
import { authorizeRoles } from "../../src/middlewares/authorizeRoles";

import { verifyAccessToken } from "../../src/utils/jwt";
import { findUserById } from "../../src/queries/authQueries";
import type { AuthUser, AppRole } from "../../src/queries/authQueries";

vi.mock("../../src/utils/jwt", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("../../src/queries/authQueries", () => ({
  findUserById: vi.fn(),
}));

const mockedVerifyAccessToken = vi.mocked(verifyAccessToken);
const mockedFindUserById = vi.mocked(findUserById);

const testUser = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({
    id: "user-123",
    full_name: "Test Agent",
    email: "agent@example.com",
    password_hash: "not-a-real-password-hash",
    role: "agent",
    status: "approved",
    email_verified_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as AuthUser;

function createApp() {
  const app = express();

  app.get("/me", authenticate, (req, res) => {
    res.status(200).json({ data: req.currentUser });
  });

  app.get(
    "/agent-feature",
    authenticate,
    requireApprovedAccount,
    authorizeRoles("agent"),
    (_req, res) => {
      res.status(200).json({ message: "Access granted" });
    },
  );

  app.get(
    "/admin-feature",
    authenticate,
    requireApprovedAccount,
    authorizeRoles("admin"),
    (_req, res) => {
      res.status(200).json({ message: "Access granted" });
    },
  );

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(500).json({ message: "Internal server error" });
    },
  );

  return app;
}

describe("Authentication and authorization middleware", () => {
  const app = createApp();

  beforeEach(() => {
    vi.resetAllMocks();

    mockedVerifyAccessToken.mockResolvedValue({
      userId: "user-123",
      role: "agent",
    });

    mockedFindUserById.mockResolvedValue(testUser());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authenticate", () => {
    it("rejects requests without an authorization header", async () => {
      const response = await request(app).get("/me");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Authentication required");
      expect(mockedVerifyAccessToken).not.toHaveBeenCalled();
    });

    it("rejects an invalid authorization header", async () => {
      const response = await request(app)
        .get("/me")
        .set("Authorization", "Basic some-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid authorization header");
    });

    it("rejects an invalid or expired JWT", async () => {
      mockedVerifyAccessToken.mockRejectedValue(new Error("Invalid token"));

      const response = await request(app)
        .get("/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid or expired access token");
      expect(mockedFindUserById).not.toHaveBeenCalled();
    });

    it("rejects a token when the user no longer exists", async () => {
      mockedFindUserById.mockResolvedValue(null);

      const response = await request(app)
        .get("/me")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("User account no longer exists");
    });

    it("rejects users whose email is not verified", async () => {
      mockedFindUserById.mockResolvedValue(
        testUser({ email_verified_at: null }),
      );

      const response = await request(app)
        .get("/me")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("EMAIL_NOT_VERIFIED");
    });

    it.each(["suspended", "deactivated"] as const)(
      "rejects users with status %s",
      async (status) => {
        mockedFindUserById.mockResolvedValue(testUser({ status }));

        const response = await request(app)
          .get("/me")
          .set("Authorization", "Bearer valid-token");

        expect(response.status).toBe(403);
        expect(response.body.code).toBe("ACCOUNT_INACTIVE");
        expect(response.body.status).toBe(status);
      },
    );

    it("returns current database role and status for a pending user", async () => {
      mockedFindUserById.mockResolvedValue(
        testUser({ role: "agent", status: "pending" }),
      );

      const response = await request(app)
        .get("/me")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe("agent");
      expect(response.body.data.status).toBe("pending");
      expect(response.body.data.emailVerified).toBe(true);
      expect(response.body.data.password_hash).toBeUndefined();
    });

    it("uses the current database role rather than a stale JWT role", async () => {
      mockedVerifyAccessToken.mockResolvedValue({
        userId: "user-123",
        role: "agent",
      });

      mockedFindUserById.mockResolvedValue(testUser({ role: "buyer" }));

      const response = await request(app)
        .get("/me")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe("buyer");
    });
  });

  describe("requireApprovedAccount", () => {
    it("allows an approved account", async () => {
      const response = await request(app)
        .get("/agent-feature")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
    });

    it.each(["pending", "rejected"] as const)(
      "blocks a %s account from approved-only features",
      async (status) => {
        mockedFindUserById.mockResolvedValue(testUser({ status }));

        const response = await request(app)
          .get("/agent-feature")
          .set("Authorization", "Bearer valid-token");

        expect(response.status).toBe(403);
        expect(response.body.code).toBe("ACCOUNT_NOT_APPROVED");
        expect(response.body.status).toBe(status);
      },
    );
  });

  describe("authorizeRoles", () => {
    it("allows a role listed in the permitted roles", async () => {
      const response = await request(app)
        .get("/agent-feature")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
    });

    it("blocks a buyer from an agent-only feature", async () => {
      mockedFindUserById.mockResolvedValue(testUser({ role: "buyer" }));

      const response = await request(app)
        .get("/agent-feature")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
    });

    it("blocks an agent from an admin-only feature", async () => {
      const response = await request(app)
        .get("/admin-feature")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
    });
  });
});
