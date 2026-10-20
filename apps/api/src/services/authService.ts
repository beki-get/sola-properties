import type { PoolClient } from "pg";
import { pool } from "../config/database";
import {
  createEmailVerification,
  createUser,
  findUserByEmail,
  findUserById,
  findEmailVerificationByHash,
  markEmailVerificationUsed,
  verifyUserEmail,
  expireUnusedEmailVerifications,
  createRefreshToken,
  findRefreshTokenByHash,
  linkReplacedRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  createPasswordReset,
  findPasswordResetByHash,
  markPasswordResetUsed,
  expireUnusedPasswordResets,
  updateUserPassword,
  revokeAllUserRefreshTokens,
  updateUserProfile,
} from "../queries/authQueries";
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../schemas/authSchemas";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateSecureToken, hashToken } from "../utils/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "./emailService";
import { logger } from "../utils/logger";
import { signAccessToken } from "../utils/jwt";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export interface RegisterResult {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
  };
  verificationEmailSent: boolean;
}

export async function register(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError("Invalid registration data", "VALIDATION_ERROR");
  }

  const { fullName, email, password, role } = parsed.data;

  // Fast duplicate check. The database unique index remains authoritative.
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AuthServiceError(
      "An account with this email already exists",
      "EMAIL_ALREADY_REGISTERED",
    );
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = generateSecureToken();
  const verificationTokenHash = hashToken(verificationToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  let client: PoolClient | undefined;
  let user: Awaited<ReturnType<typeof createUser>>;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    user = await createUser(
      {
        fullName,
        email,
        passwordHash,
        role,
      },
      client,
    );

    await createEmailVerification(
      {
        userId: user.id,
        emailToVerify: email,
        tokenHash: verificationTokenHash,
        expiresAt,
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error: unknown) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original database error.
      }
    }

    // Handle a concurrent registration for the same email.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthServiceError(
        "An account with this email already exists",
        "EMAIL_ALREADY_REGISTERED",
      );
    }

    throw error;
  } finally {
    client?.release();
  }

  // Send email only after the transaction commits.
  let verificationEmailSent = true;

  try {
    await sendVerificationEmail(email, verificationToken);
  } catch {
    verificationEmailSent = false;
  }

  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    verificationEmailSent,
  };
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

//login
export async function login(
  input: unknown,
  metadata: SessionMetadata = {},
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError(
      "Invalid email or password format",
      "VALIDATION_ERROR",
    );
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  if (!user || !(await verifyPassword(user.password_hash, password))) {
    throw new AuthServiceError(
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  if (user.email_verified_at === null) {
    throw new AuthServiceError(
      "Please verify your email before logging in",
      "EMAIL_NOT_VERIFIED",
    );
  }

  if (user.status !== "approved") {
    throw new AuthServiceError(
      "Your account is not approved for login",
      "ACCOUNT_NOT_APPROVED",
    );
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refreshToken = generateSecureToken();

  await createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
}

export async function refreshSession(
  rawToken: string,
  metadata: SessionMetadata = {},
): Promise<RefreshResult> {
  const client = await pool.connect();

  let result: RefreshResult | undefined;
  let reuseDetected = false;

  try {
    await client.query("BEGIN");

    const oldToken = await findRefreshTokenByHash(
      hashToken(rawToken),
      client,
      true,
    );

    if (!oldToken) {
      throw new AuthServiceError(
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN",
      );
    }

    // A previously rotated token is being reused.
    if (oldToken.replaced_by_token_id !== null) {
      await revokeRefreshTokenFamily(oldToken.token_family_id, client);
      await client.query("COMMIT");
      reuseDetected = true;
    } else {
      if (oldToken.revoked_at !== null) {
        throw new AuthServiceError(
          "Invalid refresh token",
          "INVALID_REFRESH_TOKEN",
        );
      }

      if (oldToken.expires_at.getTime() <= Date.now()) {
        await revokeRefreshToken(oldToken.id, client);
        await client.query("COMMIT");

        throw new AuthServiceError(
          "Refresh token expired",
          "INVALID_REFRESH_TOKEN",
        );
      }

      const userResult = await client.query<{
        id: string;
        role: string;
        status: string;
        email_verified_at: Date | null;
      }>(
        `SELECT id, role, status, email_verified_at
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [oldToken.user_id],
      );

      const user = userResult.rows[0];

      if (
        !user ||
        user.status !== "approved" ||
        user.email_verified_at === null
      ) {
        await revokeRefreshTokenFamily(oldToken.token_family_id, client);
        await client.query("COMMIT");

        throw new AuthServiceError(
          "Account is not eligible for login",
          "ACCOUNT_NOT_APPROVED",
        );
      }

      const replacementRawToken = generateSecureToken();

      const replacement = await createRefreshToken(
        {
          userId: oldToken.user_id,
          tokenHash: hashToken(replacementRawToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          tokenFamilyId: oldToken.token_family_id,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        },
        client,
      );

      await linkReplacedRefreshToken(oldToken.id, replacement.id, client);

      const accessToken = await signAccessToken({
        userId: user.id,
        role: user.role as
          "buyer" | "agent" | "developer" | "admin" | "finance_admin",
      });

      await client.query("COMMIT");

      result = {
        accessToken,
        refreshToken: replacementRawToken,
      };
    }
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }

  if (reuseDetected) {
    throw new AuthServiceError(
      "Refresh token reuse detected. Please log in again.",
      "REFRESH_TOKEN_REUSE",
    );
  }

  if (!result) {
    throw new Error("Refresh session did not produce a result");
  }

  return result;
}

export async function verifyEmail(
  input: unknown,
): Promise<{ id: string; role: string; status: string }> {
  const parsed = verifyEmailSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError(
      "Invalid verification token",
      "INVALID_VERIFICATION_TOKEN",
    );
  }

  const tokenHash = hashToken(parsed.data.token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const verification = await findEmailVerificationByHash(tokenHash, client);

    if (
      !verification ||
      verification.used_at !== null ||
      verification.expires_at.getTime() <= Date.now()
    ) {
      throw new AuthServiceError(
        "Invalid or expired verification token",
        "INVALID_VERIFICATION_TOKEN",
      );
    }

    const consumed = await markEmailVerificationUsed(verification.id, client);

    if (!consumed) {
      throw new AuthServiceError(
        "Invalid or expired verification token",
        "INVALID_VERIFICATION_TOKEN",
      );
    }

    const user = await verifyUserEmail(
      verification.user_id,
      verification.email_to_verify,
      client,
    );

    if (!user) {
      throw new AuthServiceError(
        "Invalid or expired verification token",
        "INVALID_VERIFICATION_TOKEN",
      );
    }

    await client.query("COMMIT");

    return {
      id: user.id,
      role: user.role,
      status: user.status,
    };
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release();
  }
}

// Resend verification email
const RESEND_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function resendVerification(input: unknown): Promise<void> {
  const parsed = resendVerificationSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError("Invalid email address", "VALIDATION_ERROR");
  }

  const { email } = parsed.data;
  const user = await findUserByEmail(email);

  if (!user || user.email_verified_at !== null) {
    return;
  }

  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESEND_VERIFICATION_TTL_MS);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await expireUnusedEmailVerifications(user.id, client);

    await createEmailVerification(
      {
        userId: user.id,
        emailToVerify: user.email,
        tokenHash,
        expiresAt,
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }

    throw error;
  } finally {
    client.release();
  }

  try {
    await sendVerificationEmail(user.email, token);
  } catch (error: unknown) {
    logger.warn(
      { err: error },
      "Verification email delivery failed during resend",
    );
  }
}

// Request password reset

const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

export async function requestPasswordReset(input: unknown): Promise<void> {
  const parsed = requestPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError("Invalid email address", "VALIDATION_ERROR");
  }

  const { email } = parsed.data;
  const user = await findUserByEmail(email);

  // Do not reveal whether an account exists.
  if (!user || user.email_verified_at === null) {
    return;
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await expireUnusedPasswordResets(user.id, client);

    await createPasswordReset(
      {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }

  // Send only after the database transaction commits.
  try {
    await sendPasswordResetEmail(user.email, rawToken);
  } catch (error: unknown) {
    logger.warn({ err: error }, "Password-reset email delivery failed");
  }
}

export async function resetPassword(input: unknown): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError(
      "Invalid or expired password-reset token",
      "INVALID_PASSWORD_RESET_TOKEN",
    );
  }

  const { token, newPassword } = parsed.data;
  const tokenHash = hashToken(token);

  // Perform expensive password hashing before opening the transaction.
  const passwordHash = await hashPassword(newPassword);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reset = await findPasswordResetByHash(tokenHash, client, true);

    if (
      !reset ||
      reset.used_at !== null ||
      reset.expires_at.getTime() <= Date.now()
    ) {
      throw new AuthServiceError(
        "Invalid or expired password-reset token",
        "INVALID_PASSWORD_RESET_TOKEN",
      );
    }

    // The conditional update protects against token reuse.
    const consumed = await markPasswordResetUsed(reset.id, client);

    if (!consumed) {
      throw new AuthServiceError(
        "Invalid or expired password-reset token",
        "INVALID_PASSWORD_RESET_TOKEN",
      );
    }

    const updated = await updateUserPassword(
      reset.user_id,
      passwordHash,
      client,
    );

    if (!updated) {
      throw new AuthServiceError(
        "Invalid or expired password-reset token",
        "INVALID_PASSWORD_RESET_TOKEN",
      );
    }

    await expireUnusedPasswordResets(reset.user_id, client);
    await revokeAllUserRefreshTokens(reset.user_id, client);

    await client.query("COMMIT");
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }
}

//get current user
export interface CurrentUserResult {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getCurrentUser(
  userId: string,
): Promise<CurrentUserResult> {
  const user = await findUserById(userId);

  if (!user) {
    throw new AuthServiceError("Authentication required", "USER_NOT_FOUND");
  }

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.email_verified_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

//logout
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) {
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const token = await findRefreshTokenByHash(
      hashToken(rawToken),
      client,
      true,
    );

    if (token) {
      await revokeRefreshTokenFamily(token.token_family_id, client);
    }

    await client.query("COMMIT");
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }
}

//update user profile
const PROFILE_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function updateProfile(userId: string, input: unknown) {
  const parsed = updateProfileSchema.safeParse(input);

  if (!parsed.success) {
    throw new AuthServiceError(
      "Invalid profile information",
      "VALIDATION_ERROR",
    );
  }

  const user = await findUserById(userId);

  if (!user) {
    throw new AuthServiceError("User not found", "USER_NOT_FOUND");
  }

  const fullName = parsed.data.fullName ?? user.full_name;
  const email = parsed.data.email ?? user.email;
  const emailChanged = email !== user.email;
  let verificationToken: string | null = null;

  const client = await pool.connect();
  let updatedUser;

  try {
    await client.query("BEGIN");

    updatedUser = await updateUserProfile(userId, fullName, email, client);

    if (!updatedUser) {
      throw new AuthServiceError("User not found", "USER_NOT_FOUND");
    }

    if (emailChanged) {
      await expireUnusedEmailVerifications(userId, client);

      verificationToken = generateSecureToken();

      await createEmailVerification(
        {
          userId,
          emailToVerify: email,
          tokenHash: hashToken(verificationToken),
          expiresAt: new Date(Date.now() + PROFILE_VERIFICATION_TTL_MS),
        },
        client,
      );
    }

    await client.query("COMMIT");
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthServiceError(
        "Email address is already in use",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    throw error;
  } finally {
    client.release();
  }

  let verificationEmailSent = true;

  if (verificationToken) {
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (error: unknown) {
      verificationEmailSent = false;

      logger.warn({ err: error }, "Profile email verification delivery failed");
    }
  }
  return {
    id: updatedUser.id,
    fullName: updatedUser.full_name,
    email: updatedUser.email,
    role: updatedUser.role,
    status: updatedUser.status,
    emailVerifiedAt: updatedUser.email_verified_at,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
    verificationEmailSent,
  };
}
