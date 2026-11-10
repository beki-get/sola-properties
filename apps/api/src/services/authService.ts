import { withTransaction } from "../utils/withTransaction";
import { writeAuditLog } from "../utils/auditLog";
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
  findUserByIdForUpdate,
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

  let user: Awaited<ReturnType<typeof createUser>>;

  try {
    user = await withTransaction(async (client) => {
      const createdUser = await createUser(
        { fullName, email, passwordHash, role },
        client,
      );

      await createEmailVerification(
        {
          userId: createdUser.id,
          emailToVerify: email,
          tokenHash: verificationTokenHash,
          expiresAt,
        },
        client,
      );

      await writeAuditLog(client, {
        actorId: createdUser.id,
        action: "user.registered",
        entityType: "user",
        entityId: createdUser.id,
        newValues: {
          role: createdUser.role,
          status: createdUser.status,
        },
      });

      return createdUser;
    });
  } catch (error: unknown) {
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

  if (user.status === "suspended" || user.status === "deactivated") {
    throw new AuthServiceError(
      "Your account has been suspended or deactivated. Please contact support.",
      "ACCOUNT_UNAVAILABLE",
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

//refresh
export async function refreshSession(
  rawToken: string,
  metadata: SessionMetadata = {},
): Promise<RefreshResult> {
  type TransactionResult =
    | { outcome: "success"; result: RefreshResult }
    | { outcome: "reuse" }
    | { outcome: "expired" }
    | { outcome: "inactive" };

  const transactionResult = await withTransaction<TransactionResult>(
    async (client) => {
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

      if (oldToken.replaced_by_token_id !== null) {
        await revokeRefreshTokenFamily(oldToken.token_family_id, client);

        await writeAuditLog(client, {
          actorId: oldToken.user_id,
          action: "auth.refresh_token_reuse_detected",
          entityType: "refresh_token",
          entityId: oldToken.id,
          newValues: { token_family_revoked: true },
        });

        return { outcome: "reuse" };
      }

      if (oldToken.revoked_at !== null) {
        throw new AuthServiceError(
          "Invalid refresh token",
          "INVALID_REFRESH_TOKEN",
        );
      }

      if (oldToken.expires_at.getTime() <= Date.now()) {
        await revokeRefreshToken(oldToken.id, client);
        return { outcome: "expired" };
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
        user.email_verified_at === null ||
        user.status === "suspended" ||
        user.status === "deactivated"
      ) {
        await revokeRefreshTokenFamily(oldToken.token_family_id, client);
        return { outcome: "inactive" };
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

      return {
        outcome: "success",
        result: {
          accessToken,
          refreshToken: replacementRawToken,
        },
      };
    },
  );

  if (transactionResult.outcome === "reuse") {
    throw new AuthServiceError(
      "Refresh token reuse detected. Please log in again.",
      "REFRESH_TOKEN_REUSE",
    );
  }

  if (
    transactionResult.outcome === "expired" ||
    transactionResult.outcome === "inactive"
  ) {
    throw new AuthServiceError(
      transactionResult.outcome === "expired"
        ? "Refresh token expired"
        : "Account is not eligible for login",
      transactionResult.outcome === "expired"
        ? "INVALID_REFRESH_TOKEN"
        : "ACCOUNT_INACTIVE",
    );
  }

  return transactionResult.result;
}

//verify email
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
  return withTransaction(async (client) => {
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

    await writeAuditLog(client, {
      actorId: user.id,
      action: "user.email_verified",
      entityType: "user",
      entityId: user.id,
      oldValues: { email_verified: false },
      newValues: {
        email_verified: true,
        role: user.role,
        status: user.status,
      },
    });

    return {
      id: user.id,
      role: user.role,
      status: user.status,
    };
  });
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

  await withTransaction(async (client) => {
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
  });

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
  await withTransaction(async (client) => {
    await expireUnusedPasswordResets(user.id, client);

    await createPasswordReset(
      {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      client,
    );
  });
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
  await withTransaction(async (client) => {
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

    await writeAuditLog(client, {
      actorId: reset.user_id,
      action: "user.password_reset_completed",
      entityType: "user",
      entityId: reset.user_id,
      newValues: { password_reset_completed: true },
    });
  });
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

  await withTransaction(async (client) => {
    const token = await findRefreshTokenByHash(
      hashToken(rawToken),
      client,
      true,
    );

    if (token) {
      await revokeRefreshTokenFamily(token.token_family_id, client);
    }
  });
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

  let verificationToken: string | null = null;
  let updatedUser;

  try {
    const result = await withTransaction(async (client) => {
      const user = await findUserByIdForUpdate(userId, client);

      if (!user) {
        throw new AuthServiceError("User not found", "USER_NOT_FOUND");
      }

      const fullName = parsed.data.fullName ?? user.full_name;
      const email = parsed.data.email ?? user.email;
      const emailChanged = email !== user.email;
      const fullNameChanged = fullName !== user.full_name;

      const updated = await updateUserProfile(userId, fullName, email, client);

      if (!updated) {
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

      if (fullNameChanged || emailChanged) {
        await writeAuditLog(client, {
          actorId: userId,
          action: "user.profile_updated",
          entityType: "user",
          entityId: userId,
          oldValues: {
            ...(fullNameChanged && { full_name: user.full_name }),
            ...(emailChanged && { email: user.email }),
          },
          newValues: {
            ...(fullNameChanged && { full_name: updated.full_name }),
            ...(emailChanged && { email: updated.email }),
          },
        });
      }

      if (emailChanged) {
        await writeAuditLog(client, {
          actorId: userId,
          action: "user.email_changed",
          entityType: "user",
          entityId: userId,
          oldValues: { email: user.email },
          newValues: {
            email: updated.email,
            email_verification_required: true,
          },
        });
      }

      return updated;
    });

    updatedUser = result;
  } catch (error: unknown) {
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
  }

  let verificationEmailSent = true;

  if (verificationToken) {
    try {
      await sendVerificationEmail(updatedUser.email, verificationToken);
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
