import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../src/middlewares/authenticate", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.currentUser = {
      id: "user-123",
      fullName: "Test User",
      email: "test@example.com",
      role: "buyer",
      status: "approved",
      emailVerified: true,
    };

    next();
  },
}));

vi.mock("../../src/services/authService", () => {
  class AuthServiceError extends Error {
    constructor(
      message: string,
      public readonly code: string,
    ) {
      super(message);
      this.name = "AuthServiceError";
    }
  }

  return {
    AuthServiceError,
    register: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    refreshSession: vi.fn(),
    logout: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  };
});

vi.mock("../../src/middlewares/authenticate", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.currentUser = {
      id: "user-123",
      fullName: "Test User",
      email: "test@example.com",
      role: "buyer",
      status: "approved",
      emailVerified: true,
    };

    next();
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
  register,
  login,
  verifyEmail,
  resendVerification,
  refreshSession,
  logout,
  requestPasswordReset,
  resetPassword,
  AuthServiceError,
} from "../../src/services/authService";
import authRoutes from "../../src/routes/authRoutes";

const mockRegister = vi.mocked(register);
const mockLogin = vi.mocked(login);
const mockVerifyEmail = vi.mocked(verifyEmail);
const mockResendVerification = vi.mocked(resendVerification);
const mockRefreshSession = vi.mocked(refreshSession);
const mockLogout = vi.mocked(logout);
const mockRequestPasswordReset = vi.mocked(requestPasswordReset);
const mockResetPassword = vi.mocked(resetPassword);

const app = express();
app.use(express.json());
app.use("/api/v1/auth", authRoutes);

const testUser = {
  id: "user-123",
  fullName: "Test User",
  email: "test@example.com",
  role: "buyer",
  status: "approved",
  emailVerified: true,
};

const testLoginResult = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  user: testUser,
};

describe("Authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /register", () => {
    it("returns 201 when registration succeeds", async () => {
      mockRegister.mockResolvedValueOnce({
        user: testUser,
        verificationEmailSent: true,
      } as never);

      const response = await request(app).post("/api/v1/auth/register").send({
        fullName: "Test User",
        email: "test@example.com",
        password: "StrongPassword123!",
        role: "buyer",
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject(testUser);
      expect(mockRegister).toHaveBeenCalledOnce();
    });

    it("returns 400 for invalid registration data", async () => {
      mockRegister.mockRejectedValueOnce(
        new AuthServiceError("Invalid input", "VALIDATION_ERROR"),
      );

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "invalid-email" });

      expect(response.status).toBe(400);
    });

    it("returns 409 when the email is already registered", async () => {
      mockRegister.mockRejectedValueOnce(
        new AuthServiceError(
          "Email already registered",
          "EMAIL_ALREADY_REGISTERED",
        ),
      );

      const response = await request(app).post("/api/v1/auth/register").send({
        fullName: "Test User",
        email: "test@example.com",
        password: "StrongPassword123!",
        role: "buyer",
      });

      expect(response.status).toBe(409);
    });

    it("returns 500 for an unexpected registration error", async () => {
      mockRegister.mockRejectedValueOnce(new Error("Unexpected failure"));

      const response = await request(app).post("/api/v1/auth/register").send({
        fullName: "Test User",
        email: "test@example.com",
        password: "StrongPassword123!",
        role: "buyer",
      });

      expect(response.status).toBe(500);
    });
  });

  describe("POST /login", () => {
    it("returns an access token and sets the refresh cookie", async () => {
      mockLogin.mockResolvedValueOnce(testLoginResult as never);

      const response = await request(app).post("/api/v1/auth/login").send({
        email: "test@example.com",
        password: "StrongPassword123!",
      });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe("test-access-token");
      expect(response.body.data.user).toEqual(testUser);
      expect(response.body.data.refreshToken).toBeUndefined();

      const cookies = response.headers["set-cookie"];
      const cookieHeader = Array.isArray(cookies)
        ? cookies.join(";")
        : (cookies ?? "");
      expect(cookieHeader).toContain("sola_refresh_token=");
      expect(cookieHeader).toContain("HttpOnly");
    });

    it("returns 400 for invalid login input", async () => {
      mockLogin.mockRejectedValueOnce(
        new AuthServiceError("Invalid input", "VALIDATION_ERROR"),
      );

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "invalid-email", password: "" });

      expect(response.status).toBe(400);
    });

    it("returns 401 for invalid credentials", async () => {
      mockLogin.mockRejectedValueOnce(
        new AuthServiceError("Invalid credentials", "INVALID_CREDENTIALS"),
      );

      const response = await request(app).post("/api/v1/auth/login").send({
        email: "test@example.com",
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
    });

    it.each(["EMAIL_NOT_VERIFIED", "ACCOUNT_NOT_APPROVED"])(
      "returns 403 when login is blocked by %s",
      async (code) => {
        mockLogin.mockRejectedValueOnce(
          new AuthServiceError("Login not permitted", code),
        );

        const response = await request(app).post("/api/v1/auth/login").send({
          email: "test@example.com",
          password: "StrongPassword123!",
        });

        expect(response.status).toBe(403);
      },
    );

    it("returns 500 for an unexpected login error", async () => {
      mockLogin.mockRejectedValueOnce(new Error("Unexpected failure"));

      const response = await request(app).post("/api/v1/auth/login").send({
        email: "test@example.com",
        password: "StrongPassword123!",
      });

      expect(response.status).toBe(500);
    });
  });

  describe("POST /verify-email", () => {
    it("returns 200 when email verification succeeds", async () => {
      mockVerifyEmail.mockResolvedValueOnce({
        id: testUser.id,
        role: testUser.role,
        status: testUser.status,
      } as never);

      const response = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ token: "valid-verification-token" });

      expect(response.status).toBe(200);
      expect(mockVerifyEmail).toHaveBeenCalledOnce();
    });

    it("returns 400 when the verification token is invalid", async () => {
      mockVerifyEmail.mockRejectedValueOnce(
        new AuthServiceError("Invalid token", "INVALID_VERIFICATION_TOKEN"),
      );

      const response = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ token: "invalid-token" });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /resend-verification", () => {
    it("returns 200 when the request is accepted", async () => {
      mockResendVerification.mockResolvedValueOnce(undefined as never);

      const response = await request(app)
        .post("/api/v1/auth/resend-verification")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(mockResendVerification).toHaveBeenCalledOnce();
    });

    it("returns 400 for invalid input", async () => {
      mockResendVerification.mockRejectedValueOnce(
        new AuthServiceError("Invalid input", "VALIDATION_ERROR"),
      );

      const response = await request(app)
        .post("/api/v1/auth/resend-verification")
        .send({ email: "invalid-email" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /me", () => {
    it("returns the authenticated user's information", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(testUser);
    });
  });

  describe("POST /refresh", () => {
    it("returns 401 when the refresh cookie is missing", async () => {
      const response = await request(app).post("/api/v1/auth/refresh");

      expect(response.status).toBe(401);
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });

    it("rotates the refresh cookie and returns a new access token", async () => {
      mockRefreshSession.mockResolvedValueOnce({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      } as never);

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", "sola_refresh_token=old-refresh-token");

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe("new-access-token");

      const cookies = response.headers["set-cookie"];
      const cookieHeader = Array.isArray(cookies)
        ? cookies.join(";")
        : (cookies ?? "");
      expect(cookies).toBeDefined();
      expect(cookieHeader).toContain("sola_refresh_token=");
      expect(mockRefreshSession).toHaveBeenCalledOnce();
    });

    it.each(["INVALID_REFRESH_TOKEN", "REFRESH_TOKEN_REUSE"])(
      "returns 401 for %s",
      async (code) => {
        mockRefreshSession.mockRejectedValueOnce(
          new AuthServiceError("Refresh failed", code),
        );

        const response = await request(app)
          .post("/api/v1/auth/refresh")
          .set("Cookie", "sola_refresh_token=invalid-token");

        expect(response.status).toBe(401);
        expect(response.headers["set-cookie"]).toBeDefined();
      },
    );

    it("returns 403 when the account is not approved", async () => {
      mockRefreshSession.mockRejectedValueOnce(
        new AuthServiceError("Account not approved", "ACCOUNT_NOT_APPROVED"),
      );

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", "sola_refresh_token=valid-token");

      expect(response.status).toBe(403);
    });

    it("returns 500 for an unexpected refresh error", async () => {
      mockRefreshSession.mockRejectedValueOnce(new Error("Unexpected failure"));

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", "sola_refresh_token=valid-token");

      expect(response.status).toBe(500);
    });
  });

  describe("POST /logout", () => {
    it("logs out and clears the refresh cookie", async () => {
      mockLogout.mockResolvedValueOnce(undefined as never);

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", "sola_refresh_token=valid-refresh-token");

      expect(response.status).toBe(200);
      expect(response.headers["set-cookie"]).toBeDefined();
      const cookies = response.headers["set-cookie"];
      const cookieHeader = Array.isArray(cookies)
        ? cookies.join(";")
        : (cookies ?? "");
      expect(cookieHeader).toContain("sola_refresh_token=");
      expect(mockLogout).toHaveBeenCalledOnce();
    });

    it("clears the cookie even when logout fails", async () => {
      mockLogout.mockRejectedValueOnce(new Error("Unexpected failure"));

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", "sola_refresh_token=valid-refresh-token");

      expect(response.status).toBe(500);
      expect(response.headers["set-cookie"]).toBeDefined();
    });
  });

  describe("POST /forgot-password", () => {
    it("returns a generic success response", async () => {
      mockRequestPasswordReset.mockResolvedValueOnce(undefined as never);

      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(mockRequestPasswordReset).toHaveBeenCalledOnce();
    });

    it("returns 400 for invalid input", async () => {
      mockRequestPasswordReset.mockRejectedValueOnce(
        new AuthServiceError("Invalid input", "VALIDATION_ERROR"),
      );

      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "invalid-email" });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /reset-password", () => {
    it("returns 200 when the password is reset successfully", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined as never);

      const response = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({
          token: "valid-reset-token",
          password: "NewStrongPassword123!",
        });

      expect(response.status).toBe(200);
      expect(mockResetPassword).toHaveBeenCalledOnce();
    });

    it("returns 400 for invalid reset input", async () => {
      mockResetPassword.mockRejectedValueOnce(
        new AuthServiceError("Invalid input", "VALIDATION_ERROR"),
      );

      const response = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "", password: "short" });

      expect(response.status).toBe(400);
    });
  });
});
