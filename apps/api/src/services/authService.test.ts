import "dotenv/config";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("./emailService", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { pool } from "../config/database";
import {
  AuthServiceError,
  register,
  login,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  refreshSession,
  logout,
  getCurrentUser,
} from "./authService";
import { sendVerificationEmail, sendPasswordResetEmail } from "./emailService";

const TEST_PASSWORD = "Correct-Password-123!";
const TEST_PREFIX = `auth-service-test-${randomUUID()}`;

const testEmails: string[] = [];

function newTestEmail(): string {
  const email = `${TEST_PREFIX}-${randomUUID()}@example.test`;
  testEmails.push(email);
  return email;
}

/**
 * Email helpers receive the raw token. Extract it from their arguments
 * without depending on the email template or argument order.
 */

function getRawToken(mockFn: ReturnType<typeof vi.fn>): string {
  const calls = mockFn.mock.calls;
  const token = calls[calls.length - 1]?.[1];

  if (typeof token !== "string" || token.length === 0) {
    throw new Error("The mocked email function did not receive a token.");
  }

  return token;
}

async function createUser(options?: {
  role?: "buyer" | "agent" | "developer";
  status?: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  verified?: boolean;
}) {
  const email = newTestEmail();
  const passwordHash = await argon2.hash(TEST_PASSWORD);

  const role = options?.role ?? "buyer";
  const status = options?.status ?? "approved";
  const verified = options?.verified ?? true;

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
      "Auth Service Test User",
      email,
      passwordHash,
      role,
      status,
      verified ? new Date() : null,
    ],
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("Test user could not be created.");
  }

  return { id: user.id, email };
}

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({
    code,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  // Delete only users created by this test, never unrelated database data.
  if (testEmails.length > 0) {
    await pool.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [
      testEmails.splice(0),
    ]);
  }
});

afterAll(async () => {
  await pool.end();
});

describe("authService — PostgreSQL integration tests", () => {
  it("registers a buyer and verifies their email, approving the buyer", async () => {
    const email = newTestEmail();

    const result = await register({
      fullName: "Integration Test Buyer",
      email,
      password: TEST_PASSWORD,
      role: "buyer",
    });

    expect(result.user).toMatchObject({
      email,
      role: "buyer",
      status: "pending",
    });
    expect(result.verificationEmailSent).toBe(true);
    expect(sendVerificationEmail).toHaveBeenCalledOnce();

    const token = getRawToken(
      vi.mocked(sendVerificationEmail) as unknown as ReturnType<typeof vi.fn>,
    );

    await verifyEmail({ token });

    const dbResult = await pool.query(
      `SELECT status, email_verified_at
       FROM users
       WHERE email = $1`,
      [email],
    );

    expect(dbResult.rows[0]).toMatchObject({
      status: "approved",
    });
    expect(dbResult.rows[0].email_verified_at).not.toBeNull();
  });

  it("does not automatically approve an agent after email verification", async () => {
    const email = newTestEmail();

    await register({
      fullName: "Integration Test Agent",
      email,
      password: TEST_PASSWORD,
      role: "agent",
    });

    const token = getRawToken(
      vi.mocked(sendVerificationEmail) as unknown as ReturnType<typeof vi.fn>,
    );

    await verifyEmail({ token });

    const result = await pool.query(
      `SELECT status, email_verified_at
       FROM users
       WHERE email = $1`,
      [email],
    );

    expect(result.rows[0].status).toBe("pending");
    expect(result.rows[0].email_verified_at).not.toBeNull();
  });

  it("rejects duplicate registration regardless of email letter case", async () => {
    const email = newTestEmail();

    await register({
      fullName: "First Registration",
      email,
      password: TEST_PASSWORD,
      role: "buyer",
    });

    await expectServiceError(
      register({
        fullName: "Duplicate Registration",
        email: email.toUpperCase(),
        password: TEST_PASSWORD,
        role: "buyer",
      }),
      "EMAIL_ALREADY_REGISTERED",
    );
  });

  it("logs in an approved, verified user and persists a refresh token", async () => {
    const user = await createUser();

    const result = await login(
      { email: user.email, password: TEST_PASSWORD },
      {
        userAgent: "Vitest integration test",
        ipAddress: "127.0.0.1",
      },
    );

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: "buyer",
      status: "approved",
    });

    const tokenHash = await import("../utils/tokens").then(({ hashToken }) =>
      hashToken(result.refreshToken),
    );

    const storedToken = await pool.query(
      `SELECT user_id, token_hash, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );

    expect(storedToken.rows).toHaveLength(1);
    expect(storedToken.rows[0]).toMatchObject({
      user_id: user.id,
      token_hash: tokenHash,
      revoked_at: null,
    });
  });

  it("rejects login when the user's email is not verified", async () => {
    const user = await createUser({ verified: false });

    await expectServiceError(
      login({ email: user.email, password: TEST_PASSWORD }),
      "EMAIL_NOT_VERIFIED",
    );
  });

  it("rejects login for a suspended account", async () => {
    const user = await createUser({ status: "suspended" });

    await expectServiceError(
      login({ email: user.email, password: TEST_PASSWORD }),
      "ACCOUNT_NOT_APPROVED",
    );
  });

  it("rotates refresh tokens and detects reuse of the old token", async () => {
    const user = await createUser();

    const firstSession = await login({
      email: user.email,
      password: TEST_PASSWORD,
    });

    const secondSession = await refreshSession(firstSession.refreshToken, {
      userAgent: "Vitest refresh test",
      ipAddress: "127.0.0.1",
    });

    expect(secondSession.refreshToken).not.toBe(firstSession.refreshToken);
    expect(secondSession.accessToken).toEqual(expect.any(String));

    await expectServiceError(
      refreshSession(firstSession.refreshToken, {
        userAgent: "Vitest refresh test",
        ipAddress: "127.0.0.1",
      }),
      "REFRESH_TOKEN_REUSE",
    );

    const { hashToken } = await import("../utils/tokens");
    const replacementHash = hashToken(secondSession.refreshToken);

    const replacement = await pool.query(
      `SELECT revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [replacementHash],
    );

    // Reuse detection should revoke the whole token family, including
    // the replacement token issued immediately before the reuse attempt.
    expect(replacement.rows).toHaveLength(1);
    expect(replacement.rows[0].revoked_at).not.toBeNull();
  });

  it("resets a password, consumes the reset token, and revokes refresh tokens", async () => {
    const user = await createUser();

    const session = await login({
      email: user.email,
      password: TEST_PASSWORD,
    });

    await requestPasswordReset({ email: user.email });

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();

    const token = getRawToken(
      vi.mocked(sendPasswordResetEmail) as unknown as ReturnType<typeof vi.fn>,
    );

    const newPassword = "New-Password-456!";

    await resetPassword({
      token,
      newPassword,
    });

    // The new password must work.
    const newSession = await login({
      email: user.email,
      password: newPassword,
    });

    expect(newSession.accessToken).toEqual(expect.any(String));

    // The old password must no longer work.
    await expectServiceError(
      login({
        email: user.email,
        password: TEST_PASSWORD,
      }),
      "INVALID_CREDENTIALS",
    );

    const { hashToken } = await import("../utils/tokens");

    const oldRefreshHash = hashToken(session.refreshToken);

    const oldRefresh = await pool.query(
      `SELECT revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [oldRefreshHash],
    );

    expect(oldRefresh.rows).toHaveLength(1);
    expect(oldRefresh.rows[0].revoked_at).not.toBeNull();

    const resetRow = await pool.query(
      `SELECT used_at
       FROM password_resets
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );

    expect(resetRow.rows[0]?.used_at).not.toBeNull();
  });

  it("revokes the refresh-token family on logout", async () => {
    const user = await createUser();

    const session = await login({
      email: user.email,
      password: TEST_PASSWORD,
    });

    await logout(session.refreshToken);

    await expectServiceError(
      refreshSession(session.refreshToken, {}),
      "INVALID_REFRESH_TOKEN",
    );
  });

  it("returns the current user and rejects an unknown user ID", async () => {
    const user = await createUser();

    const currentUser = await getCurrentUser(user.id);

    expect(currentUser).toMatchObject({
      id: user.id,
      email: user.email,
      role: "buyer",
      status: "approved",
    });

    await expectServiceError(getCurrentUser(randomUUID()), "USER_NOT_FOUND");
  });

  it("resends verification for an unverified account", async () => {
    const user = await createUser({ verified: false });

    await resendVerification({ email: user.email });

    expect(sendVerificationEmail).toHaveBeenCalledOnce();

    const verification = await pool.query(
      `SELECT used_at, expires_at
       FROM email_verification
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );

    expect(verification.rows).toHaveLength(1);
    expect(verification.rows[0].used_at).toBeNull();
    expect(new Date(verification.rows[0].expires_at).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});
