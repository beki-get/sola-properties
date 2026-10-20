
import type { PoolClient } from "pg";
import { pool } from "../config/database";
import {
  submitAccountVerificationSchema,
  MAX_VERIFICATION_SUBMISSIONS,
} from "../schemas/accountVerificationSchema";
import {
  countVerificationSubmissions,
  createVerificationRequest,
  findApplicantForUpdate,
  findVerificationHistory,
  setApplicantPending,
  findPendingVerificationRequests,
  findVerificationRequestById,
  findVerificationRequestForUpdate,
  updateApplicantAccountStatus,
  updateVerificationDecision,
  type AccountVerificationRequest,
} from "../queries/accountVerificationQueries";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;



export class AccountVerificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AccountVerificationError";
  }
}

export async function submitVerificationRequest(
  userId: string,
  input: unknown,
): Promise<AccountVerificationRequest> {
  const parsed = submitAccountVerificationSchema.safeParse(input);

  if (!parsed.success) {
    throw new AccountVerificationError(
      "Invalid verification application data",
      "VALIDATION_ERROR",
      400,
    );
  }

  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Serialize submissions for this user to enforce the limit safely.
    const applicant = await findApplicantForUpdate(userId, client);

    if (!applicant) {
      throw new AccountVerificationError(
        "User account not found",
        "USER_NOT_FOUND",
        404,
      );
    }

    if (applicant.role !== "agent" && applicant.role !== "developer") {
      throw new AccountVerificationError(
        "Only agents and developers can submit verification applications",
        "ROLE_NOT_ELIGIBLE",
        403,
      );
    }

    if (!applicant.email_verified_at) {
      throw new AccountVerificationError(
        "Verify your email before submitting an application",
        "EMAIL_NOT_VERIFIED",
        403,
      );
    }

    if (applicant.status === "approved") {
      throw new AccountVerificationError(
        "Your account is already approved",
        "ACCOUNT_ALREADY_APPROVED",
        409,
      );
    }

    if (
      applicant.status === "suspended" ||
      applicant.status === "deactivated"
    ) {
      throw new AccountVerificationError(
        "This account cannot submit a verification application",
        "ACCOUNT_INACTIVE",
        403,
      );
    }

    const submissionCount = await countVerificationSubmissions(
      userId,
      client,
    );

    if (submissionCount >= MAX_VERIFICATION_SUBMISSIONS) {
      throw new AccountVerificationError(
        "You have reached the maximum number of verification submissions. Contact an administrator for assistance.",
        "SUBMISSION_LIMIT_REACHED",
        409,
      );
    }

    // A unique-index violation is translated below if an open
    // request already exists.
    const request = await createVerificationRequest(
      userId,
      applicant.role,
      parsed.data,
      client,
    );

    // A rejected applicant returns to pending when resubmitting.
    await setApplicantPending(userId, client);

    await client.query("COMMIT");
    return request;
  } catch (error: unknown) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original error.
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AccountVerificationError(
        "You already have a pending verification application",
        "APPLICATION_ALREADY_PENDING",
        409,
      );
    }

    throw error;
  } finally {
    client?.release();
  }
}

export async function getMyVerificationHistory(
  userId: string,
): Promise<AccountVerificationRequest[]> {
  return findVerificationHistory(userId);
}


export async function listPendingVerificationRequests(
  page: number,
  pageSize: number,
) {
  const limit = Math.min(Math.max(pageSize, 1), 100);
  const currentPage = Math.max(page, 1);
  const offset = (currentPage - 1) * limit;

  const result = await findPendingVerificationRequests(limit, offset);

  return {
    ...result,
    page: currentPage,
    pageSize: limit,
    totalPages: Math.ceil(result.total / limit),
  };
}

export async function getVerificationRequestForAdmin(
  requestId: string,
) {
  if (!UUID_PATTERN.test(requestId)) {
    throw new AccountVerificationError(
      "Invalid verification request ID",
      "INVALID_REQUEST_ID",
      400,
    );
  }

  const request = await findVerificationRequestById(requestId);

  if (!request) {
    throw new AccountVerificationError(
      "Verification request not found",
      "REQUEST_NOT_FOUND",
      404,
    );
  }

  return request;
}

export async function decideVerificationRequest(
  adminId: string,
  requestId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<AccountVerificationRequest> {
  if (!UUID_PATTERN.test(requestId)) {
    throw new AccountVerificationError(
      "Invalid verification request ID",
      "INVALID_REQUEST_ID",
      400,
    );
  }

  const rejectionReason = reason?.trim() || null;

  if (decision === "rejected" && !rejectionReason) {
    throw new AccountVerificationError(
      "A rejection reason is required",
      "REJECTION_REASON_REQUIRED",
      400,
    );
  }

  if (rejectionReason && rejectionReason.length > 2000) {
    throw new AccountVerificationError(
      "Rejection reason must not exceed 2000 characters",
      "INVALID_REJECTION_REASON",
      400,
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const request = await findVerificationRequestForUpdate(
      requestId,
      client,
    );

    if (!request) {
      throw new AccountVerificationError(
        "Verification request not found",
        "REQUEST_NOT_FOUND",
        404,
      );
    }

    if (request.status !== "pending") {
      throw new AccountVerificationError(
        "This verification request has already been decided",
        "REQUEST_ALREADY_DECIDED",
        409,
      );
    }

    // Lock the applicant and ensure the decision won't reactivate
    // an account that has been suspended or deactivated.
    const applicant = await findApplicantForUpdate(
      request.user_id,
      client,
    );

    if (!applicant) {
      throw new AccountVerificationError(
        "Applicant account not found",
        "USER_NOT_FOUND",
        404,
      );
    }

    if (
      applicant.role !== request.applicant_role ||
      applicant.status !== "pending" ||
      !applicant.email_verified_at
    ) {
      throw new AccountVerificationError(
        "The applicant's account is not eligible for this decision",
        "APPLICANT_STATE_CONFLICT",
        409,
      );
    }

    const updatedRequest = await updateVerificationDecision(
      requestId,
      adminId,
      decision,
      decision === "rejected" ? rejectionReason : null,
      client,
    );

    const accountUpdated = await updateApplicantAccountStatus(
      request.user_id,
      decision,
      client,
    );

    if (!accountUpdated) {
      throw new AccountVerificationError(
        "Applicant account changed during the decision",
        "APPLICANT_STATE_CONFLICT",
        409,
      );
    }

    await client.query("COMMIT");
    return updatedRequest;
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
