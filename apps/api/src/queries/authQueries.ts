import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../config/database";

export type AppRole =
  "buyer" | "agent" | "developer" | "admin" | "finance_admin";

export interface AuthUser extends QueryResultRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: AppRole;
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CreateUserInput {
  fullName: string;
  email: string;
  passwordHash: string;
  role: AppRole;
}

// Find a user by email, ignoring letter case.
export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const result = await pool.query<AuthUser>(
    `SELECT *
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email],
  );

  return result.rows[0] ?? null;
}

// Find a user by ID.
export async function findUserById(userId: string): Promise<AuthUser | null> {
  const result = await pool.query<AuthUser>(
    `SELECT
       id,
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at,
       created_at,
       updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

// Create a new user.
export async function createUser(
  input: CreateUserInput,
  client?: PoolClient,
): Promise<AuthUser> {
  const sql = `INSERT INTO users (full_name, email, password_hash, role)
               VALUES ($1, $2, $3, $4)
               RETURNING *`;

  const values = [input.fullName, input.email, input.passwordHash, input.role];

  const result = client
    ? await client.query<AuthUser>(sql, values)
    : await pool.query<AuthUser>(sql, values);

  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create user");
  }

  return user;
}
export interface RefreshToken extends QueryResultRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_family_id: string;
  replaced_by_token_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  last_used_at: Date | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
}

interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  tokenFamilyId?: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

// Create a refresh-token record.
export async function createRefreshToken(
  input: CreateRefreshTokenInput,
  client?: PoolClient,
): Promise<RefreshToken> {
  const db = client ?? pool;

  const result = await db.query<RefreshToken>(
    `INSERT INTO refresh_tokens (
       user_id,
       token_hash,
       expires_at,
       token_family_id,
       user_agent,
       ip_address
     )
     VALUES ($1, $2, $3, COALESCE($4::uuid, gen_random_uuid()), $5, $6)
     RETURNING *`,
    [
      input.userId,
      input.tokenHash,
      input.expiresAt,
      input.tokenFamilyId ?? null,
      input.userAgent ?? null,
      input.ipAddress ?? null,
    ],
  );

  const token = result.rows[0];

  if (!token) {
    throw new Error("Failed to create refresh token");
  }

  return token;
}

// Find a token by its hash, including expired or revoked tokens.
export async function findRefreshTokenByHash(
  tokenHash: string,
  client?: PoolClient,
  forUpdate = false,
): Promise<RefreshToken | null> {
  const db = client ?? pool;

  const result = await db.query<RefreshToken>(
    `SELECT *
     FROM refresh_tokens
     WHERE token_hash = $1
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

// Record when a refresh token was last used.
export async function updateRefreshTokenLastUsed(
  tokenId: string,
): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens
     SET last_used_at = NOW()
     WHERE id = $1`,
    [tokenId],
  );
}

// Revoke a refresh token.
export async function revokeRefreshToken(
  tokenId: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool;

  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1`,
    [tokenId],
  );
}

// Link an old token to its replacement.
export async function linkReplacedRefreshToken(
  oldTokenId: string,
  newTokenId: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool;

  await db.query(
    `UPDATE refresh_tokens
     SET replaced_by_token_id = $2,
         revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1`,
    [oldTokenId, newTokenId],
  );
}

export async function revokeRefreshTokenFamily(
  familyId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE token_family_id = $1`,
    [familyId],
  );
}

export interface PasswordReset extends QueryResultRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

interface CreatePasswordResetInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

// Create a password-reset record.
export async function createPasswordReset(
  input: CreatePasswordResetInput,
  client?: PoolClient,
): Promise<PasswordReset> {
  const db = client ?? pool;

  const result = await db.query<PasswordReset>(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.userId, input.tokenHash, input.expiresAt],
  );

  const reset = result.rows[0];

  if (!reset) {
    throw new Error("Failed to create password-reset record");
  }

  return reset;
}

// Find a reset token, optionally locking it for a transaction.
export async function findPasswordResetByHash(
  tokenHash: string,
  client?: PoolClient,
  forUpdate = false,
): Promise<PasswordReset | null> {
  const db = client ?? pool;

  const result = await db.query<PasswordReset>(
    `SELECT *
     FROM password_resets
     WHERE token_hash = $1
     LIMIT 1${forUpdate && client ? " FOR UPDATE" : ""}`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

// Consume a reset token only if it is still valid.
export async function markPasswordResetUsed(
  resetId: string,
  client?: PoolClient,
): Promise<boolean> {
  const db = client ?? pool;

  const result = await db.query(
    `UPDATE password_resets
     SET used_at = NOW()
     WHERE id = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING id`,
    [resetId],
  );

  return result.rowCount === 1;
}

// Update a user's password within the current transaction.
export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  client: PoolClient,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE users
     SET password_hash = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId, passwordHash],
  );

  return result.rowCount === 1;
}

// Invalidate all other outstanding reset tokens for a user.
export async function expireUnusedPasswordResets(
  userId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE password_resets
     SET expires_at = NOW()
     WHERE user_id = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [userId],
  );
}

// Revoke every refresh-token session belonging to a user.
export async function revokeAllUserRefreshTokens(
  userId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE user_id = $1`,
    [userId],
  );
}

export interface EmailVerification extends QueryResultRow {
  id: string;
  user_id: string;
  email_to_verify: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

interface CreateEmailVerificationInput {
  userId: string;
  emailToVerify: string;
  tokenHash: string;
  expiresAt: Date;
}

// Create an email-verification record.
// Create an email-verification record, optionally within an existing transaction.
export async function createEmailVerification(
  input: CreateEmailVerificationInput,
  client?: PoolClient,
): Promise<EmailVerification> {
  const sql = `INSERT INTO email_verification (
                 user_id,
                 email_to_verify,
                 token_hash,
                 expires_at
               )
               VALUES ($1, $2, $3, $4)
               RETURNING *`;

  const values = [
    input.userId,
    input.emailToVerify,
    input.tokenHash,
    input.expiresAt,
  ];

  const result = client
    ? await client.query<EmailVerification>(sql, values)
    : await pool.query<EmailVerification>(sql, values);

  const verification = result.rows[0];

  if (!verification) {
    throw new Error("Failed to create email-verification record");
  }

  return verification;
}
// Find an email-verification record by token hash.

export async function findEmailVerificationByHash(
  tokenHash: string,
  client?: PoolClient,
): Promise<EmailVerification | null> {
  const sql = `SELECT *
               FROM email_verification
               WHERE token_hash = $1
               LIMIT 1${client ? " FOR UPDATE" : ""}`;

  const result = client
    ? await client.query<EmailVerification>(sql, [tokenHash])
    : await pool.query<EmailVerification>(sql, [tokenHash]);

  return result.rows[0] ?? null;
}

// Mark an email-verification token as used.

export async function markEmailVerificationUsed(
  verificationId: string,
  client?: PoolClient,
): Promise<boolean> {
  const sql = `UPDATE email_verification
               SET used_at = NOW()
               WHERE id = $1
                 AND used_at IS NULL
                 AND expires_at > NOW()
               RETURNING id`;

  const result = client
    ? await client.query(sql, [verificationId])
    : await pool.query(sql, [verificationId]);

  return result.rowCount === 1;
}

export interface VerifiedUser {
  id: string;
  role: AppRole;
  status: AuthUser["status"];
  email_verified_at: Date;
}

// Mark the user's email as verified.
export async function verifyUserEmail(
  userId: string,
  emailToVerify: string,
  client: PoolClient,
): Promise<VerifiedUser | null> {
  const result = await client.query<VerifiedUser>(
    `UPDATE users
SET email = $2,
    email_verified_at = NOW(),
    status = CASE
      WHEN role = 'buyer' AND status = 'pending'
        THEN 'approved'::account_status
      ELSE status
    END,
    updated_at = NOW()
WHERE id = $1
  AND LOWER(email) = LOWER($2)
  AND email_verified_at IS NULL
RETURNING id, role, status, email_verified_at`,
    [userId, emailToVerify],
  );

  return result.rows[0] ?? null;
}

export async function expireUnusedEmailVerifications(
  userId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE email_verification
     SET expires_at = NOW()
     WHERE user_id = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [userId],
  );
}

// Update a user's profile information, including full name and email address.
export async function updateUserProfile(
  userId: string,
  fullName: string,
  email: string,
  client: PoolClient,
) {
  const result = await client.query(
    `UPDATE users
     SET full_name = $2,
         email = $3,
         email_verified_at = CASE
           WHEN LOWER(users.email) <> LOWER($3)
             THEN NULL
           ELSE email_verified_at
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING
       id,
       full_name,
       email,
       role,
       status,
       email_verified_at,
       created_at,
       updated_at`,
    [userId, fullName, email],
  );

  return result.rows[0] ?? null;
}