import type { PoolClient } from "pg";
import { pool } from "../config/database";
import type { AccountStatus } from "../middlewares/authenticate";
import type { AppRole } from "./authQueries";
import type { SubmitAccountVerificationInput } from "../schemas/accountVerificationSchema";

export interface VerificationApplicant {
  id: string;
  role: AppRole;
  status: AccountStatus;
  email_verified_at: Date | null;
}

export interface AccountVerificationRequest {
  id: string;
  user_id: string;
  applicant_role: AppRole;
  legal_name: string;
  registration_number: string;
  business_name: string | null;
  business_address: string;
  contact_phone: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  submitted_at: Date;
  updated_at: Date;
  documents?: VerificationDocument[];
}

export interface VerificationDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: Date;
}

export async function findApplicantForUpdate(
  userId: string,
  client: PoolClient,
): Promise<VerificationApplicant | null> {
  const result = await client.query<VerificationApplicant>(
    `SELECT id, role, status, email_verified_at
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function countVerificationSubmissions(
  userId: string,
  client: PoolClient,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM account_verification_requests
     WHERE user_id = $1`,
    [userId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function createVerificationRequest(
  userId: string,
  role: "agent" | "developer",
  input: SubmitAccountVerificationInput,
  client: PoolClient,
): Promise<AccountVerificationRequest> {
  const result = await client.query<AccountVerificationRequest>(
    `INSERT INTO account_verification_requests (
       user_id,
       applicant_role,
       legal_name,
       registration_number,
       business_name,
       business_address,
       contact_phone,
       notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      role,
      input.legalName,
      input.registrationNumber,
      input.businessName || null,
      input.businessAddress,
      input.contactPhone,
      input.notes || null,
    ],
  );

  return result.rows[0]!;
}

export async function setApplicantPending(
  userId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE users
     SET status = 'pending',
         updated_at = NOW()
     WHERE id = $1
       AND status = 'rejected'`,
    [userId],
  );
}

export async function findVerificationHistory(
  userId: string,
): Promise<AccountVerificationRequest[]> {
  const result = await pool.query<AccountVerificationRequest>(
    `SELECT r.*,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', d.id,
                'original_filename', d.original_filename,
                'mime_type', d.mime_type,
                'file_size', d.file_size,
                'uploaded_at', d.uploaded_at
              )
              ORDER BY d.uploaded_at ASC
            )
            FROM verification_documents d
            WHERE d.verification_request_id = r.id
          ),
          '[]'::json
        ) AS documents
 FROM account_verification_requests r
 WHERE r.user_id = $1
 ORDER BY r.submitted_at DESC`,
    [userId],
  );

  return result.rows;
}

export interface AdminVerificationRequest extends AccountVerificationRequest {
  applicant_full_name: string;
  applicant_email: string;
  account_status: AccountStatus;
  email_verified_at: Date | null;
  documents?: VerificationDocument[];
}

export async function findPendingVerificationRequests(
  limit: number,
  offset: number,
): Promise<{ requests: AdminVerificationRequest[]; total: number }> {
  const [requestsResult, countResult] = await Promise.all([
    pool.query<AdminVerificationRequest>(
      `SELECT r.*,
              u.full_name AS applicant_full_name,
              u.email AS applicant_email,
              u.status AS account_status,
              u.email_verified_at
              ,
COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'id', d.id,
        'original_filename', d.original_filename,
        'mime_type', d.mime_type,
        'file_size', d.file_size,
        'uploaded_at', d.uploaded_at
      )
      ORDER BY d.uploaded_at ASC
    )
    FROM verification_documents d
    WHERE d.verification_request_id = r.id
  ),
  '[]'::json
) AS documents
       FROM account_verification_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending'
       ORDER BY r.submitted_at ASC, r.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM account_verification_requests
       WHERE status = 'pending'`,
    ),
  ]);

  return {
    requests: requestsResult.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function findVerificationRequestById(
  requestId: string,
): Promise<AdminVerificationRequest | null> {
  const result = await pool.query<AdminVerificationRequest>(
    `SELECT r.*,
            u.full_name AS applicant_full_name,
            u.email AS applicant_email,
            u.status AS account_status,
            u.email_verified_at
            ,
COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'id', d.id,
        'original_filename', d.original_filename,
        'mime_type', d.mime_type,
        'file_size', d.file_size,
        'uploaded_at', d.uploaded_at
      )
      ORDER BY d.uploaded_at ASC
    )
    FROM verification_documents d
    WHERE d.verification_request_id = r.id
  ),
  '[]'::json
) AS documents
     FROM account_verification_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1`,
    [requestId],
  );

  return result.rows[0] ?? null;
}

export async function findVerificationRequestForUpdate(
  requestId: string,
  client: PoolClient,
): Promise<AccountVerificationRequest | null> {
  const result = await client.query<AccountVerificationRequest>(
    `SELECT *
     FROM account_verification_requests
     WHERE id = $1
     FOR UPDATE`,
    [requestId],
  );

  return result.rows[0] ?? null;
}

export async function updateVerificationDecision(
  requestId: string,
  adminId: string,
  decision: "approved" | "rejected",
  rejectionReason: string | null,
  client: PoolClient,
): Promise<AccountVerificationRequest> {
  const result = await client.query<AccountVerificationRequest>(
    `UPDATE account_verification_requests
     SET status = $2::verification_request_status,
         rejection_reason = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND status = 'pending'
     RETURNING *`,
    [requestId, decision, rejectionReason, adminId],
  );

  const request = result.rows[0];

  if (!request) {
    throw new Error("Verification decision could not be saved");
  }

  return request;
}

export async function updateApplicantAccountStatus(
  userId: string,
  status: "approved" | "rejected",
  client: PoolClient,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE users
     SET status = $2::account_status,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'pending'`,
    [userId, status],
  );

  return result.rowCount === 1;
}
