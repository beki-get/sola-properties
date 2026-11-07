import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../config/database";
import { TransactionError } from "./transactionQueries";

export type DisputeStatus = "open" | "resolved" | "rejected";

export type DisputeRecord = QueryResultRow & {
  id: string;
  entity_type: "transaction" | "commission";
  entity_id: string;
  reported_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: Date | null;
  created_at: Date;
};

async function writeDisputeAudit(
  client: PoolClient,
  actorId: string,
  action: string,
  dispute: DisputeRecord,
  oldValues: unknown,
  newValues: unknown,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, old_values, new_values)
     VALUES ($1, $2, 'dispute', $3, $4, $5)`,
    [
      actorId,
      action,
      dispute.id,
      oldValues == null ? null : JSON.stringify(oldValues),
      newValues == null ? null : JSON.stringify(newValues),
    ],
  );
}

async function getTransactionForDispute(
  client: PoolClient,
  transactionId: string,
) {
  const result = await client.query<{
    id: string;
    buyer_id: string;
    seller_id: string;
    status: string;
  }>(
    `SELECT id, buyer_id, seller_id, status
     FROM transactions
     WHERE id = $1
     FOR UPDATE`,
    [transactionId],
  );

  return result.rows[0] ?? null;
}


export async function getDisputeAdminRecipients(): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE role IN ('admin', 'finance_admin')
       AND status = 'approved'`,
  );

  return result.rows.map((row) => row.id);
}

//transaction dispute creation
export async function createTransactionDispute(input: {
  transactionId: string;
  actorId: string;
  actorRole: string;
  reason: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const transaction = await getTransactionForDispute(
      client,
      input.transactionId,
    );

    // Do not reveal whether a transaction exists to unauthorized callers.
    if (
      !transaction ||
      (input.actorRole !== "admin" &&
        input.actorRole !== "finance_admin" &&
        transaction.seller_id !== input.actorId)
    ) {
      throw new TransactionError(
        404,
        "TRANSACTION_NOT_FOUND",
        "Transaction not found.",
      );
    }

    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM disputes
       WHERE entity_type = 'transaction'
         AND entity_id = $1
         AND status = 'open'
       LIMIT 1`,
      [input.transactionId],
    );

    if (existing.rowCount) {
      throw new TransactionError(
        409,
        "OPEN_DISPUTE_EXISTS",
        "An open dispute already exists for this transaction.",
      );
    }

    const inserted = await client.query<DisputeRecord>(
      `INSERT INTO disputes
         (entity_type, entity_id, reported_by, reason)
       VALUES ('transaction', $1, $2, $3)
       RETURNING *`,
      [input.transactionId, input.actorId, input.reason.trim()],
    );

    const dispute = inserted.rows[0];

    if (!dispute) {
      throw new TransactionError(
        500,
        "DISPUTE_CREATE_FAILED",
        "Failed to create the dispute.",
      );
    }

    await writeDisputeAudit(
      client,
      input.actorId,
      "transaction.dispute_opened",
      dispute,
      null,
      {
        transaction_id: input.transactionId,
        reason: dispute.reason,
        status: dispute.status,
      },
    );

    await client.query("COMMIT");
    return dispute;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    // The partial unique index remains the final concurrency safeguard.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new TransactionError(
        409,
        "OPEN_DISPUTE_EXISTS",
        "An open dispute already exists for this transaction.",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

//transaction dispute retrieval
export async function listTransactionDisputes(input: {
  transactionId: string;
  userId: string;
  userRole: string;
  status?: DisputeStatus;
  page: number;
  limit: number;
}) {
  const transaction = await pool.query<{
    id: string;
    seller_id: string;
  }>(
    `SELECT id, seller_id
     FROM transactions
     WHERE id = $1`,
    [input.transactionId],
  );

  const record = transaction.rows[0];

  if (
    !record ||
    (input.userRole !== "admin" &&
      input.userRole !== "finance_admin" &&
      record.seller_id !== input.userId)
  ) {
    throw new TransactionError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Transaction not found.",
    );
  }

  const params: unknown[] = [input.transactionId];
  let where = "entity_type = 'transaction' AND entity_id = $1";

  if (input.status) {
    params.push(input.status);
    where += ` AND status = $${params.length}`;
  }

  const offset = (input.page - 1) * input.limit;

  const result = await pool.query<DisputeRecord>(
    `SELECT *
     FROM disputes
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, input.limit, offset],
  );

  const total = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM disputes
     WHERE ${where}`,
    params,
  );

  return {
    items: result.rows,
    page: input.page,
    limit: input.limit,
    total: Number(total.rows[0]?.count ?? 0),
  };
}

//transaction dispute decision
export async function decideTransactionDispute(input: {
  disputeId: string;
  actorId: string;
  actorRole: string;
  decision: "resolved" | "rejected";
  resolutionNote: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (
      input.actorRole !== "admin" &&
      input.actorRole !== "finance_admin"
    ) {
      throw new TransactionError(
        403,
        "DISPUTE_DECISION_NOT_ALLOWED",
        "Only admin or finance users can decide disputes.",
      );
    }

    const current = await client.query<DisputeRecord>(
      `SELECT *
       FROM disputes
       WHERE id = $1
       FOR UPDATE`,
      [input.disputeId],
    );

    const dispute = current.rows[0];

    if (!dispute) {
      throw new TransactionError(
        404,
        "DISPUTE_NOT_FOUND",
        "Dispute not found.",
      );
    }

    if (dispute.status !== "open") {
      throw new TransactionError(
        409,
        "DISPUTE_ALREADY_CLOSED",
        "This dispute has already been decided.",
      );
    }

    const updatedResult = await client.query<DisputeRecord>(
      `UPDATE disputes
       SET status = $1,
           resolution_note = $2,
           resolved_by = $3,
           resolved_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        input.decision,
        input.resolutionNote.trim(),
        input.actorId,
        input.disputeId,
      ],
    );

    const updated = updatedResult.rows[0];

    if (!updated) {
      throw new TransactionError(
        500,
        "DISPUTE_DECISION_FAILED",
        "Failed to update the dispute.",
      );
    }

    await writeDisputeAudit(
      client,
      input.actorId,
      `${dispute.entity_type}.dispute_${input.decision}`,
      updated,
      {
        status: dispute.status,
        resolution_note: dispute.resolution_note,
        resolved_by: dispute.resolved_by,
        resolved_at: dispute.resolved_at,
      },
      {
        status: updated.status,
        resolution_note: updated.resolution_note,
        resolved_by: updated.resolved_by,
        resolved_at: updated.resolved_at,
      },
    );

    let buyerId: string | null = null;
    let sellerId: string;

    if (dispute.entity_type === "transaction") {
      const related = await client.query<{
        buyer_id: string;
        seller_id: string;
      }>(
        `SELECT buyer_id, seller_id
         FROM transactions
         WHERE id = $1`,
        [dispute.entity_id],
      );

      const transaction = related.rows[0];

      if (!transaction) {
        throw new TransactionError(
          404,
          "TRANSACTION_NOT_FOUND",
          "The related transaction was not found.",
        );
      }

      buyerId = transaction.buyer_id;
      sellerId = transaction.seller_id;
    } else {
      const related = await client.query<{ seller_id: string }>(
        `SELECT seller_id
         FROM commissions
         WHERE id = $1`,
        [dispute.entity_id],
      );

      const commission = related.rows[0];

      if (!commission) {
        throw new TransactionError(
          404,
          "COMMISSION_NOT_FOUND",
          "The related commission was not found.",
        );
      }

      sellerId = commission.seller_id;
    }

    await client.query("COMMIT");

    return {
      dispute: updated,
      buyerId,
      sellerId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

//commission dispute creation
export async function createCommissionDispute(input: {
  commissionId: string;
  actorId: string;
  reason: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const commissionResult = await client.query<{
      id: string;
      seller_id: string;
    }>(
      `SELECT id, seller_id
       FROM commissions
       WHERE id = $1
       FOR UPDATE`,
      [input.commissionId],
    );

    const commission = commissionResult.rows[0];

    if (!commission || commission.seller_id !== input.actorId) {
      throw new TransactionError(
        404,
        "COMMISSION_NOT_FOUND",
        "Commission not found.",
      );
    }

    const inserted = await client.query<DisputeRecord>(
      `INSERT INTO disputes (entity_type, entity_id, reported_by, reason)
       VALUES ('commission', $1, $2, $3)
       RETURNING *`,
      [input.commissionId, input.actorId, input.reason.trim()],
    );

    const dispute = inserted.rows[0];

    if (!dispute) {
      throw new TransactionError(
        500,
        "DISPUTE_CREATE_FAILED",
        "Failed to create the dispute.",
      );
    }

    await writeDisputeAudit(
      client,
      input.actorId,
      "commission.dispute_opened",
      dispute,
      null,
      {
        commission_id: input.commissionId,
        reason: dispute.reason,
        status: dispute.status,
      },
    );

    await client.query("COMMIT");
    return dispute;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new TransactionError(
        409,
        "OPEN_DISPUTE_EXISTS",
        "An open dispute already exists for this commission.",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

//commission dispute retrieval
export async function listCommissionDisputes(input: {
  commissionId: string;
  userId: string;
  userRole: string;
  status?: DisputeStatus;
  page: number;
  limit: number;
}) {
  const commissionResult = await pool.query<{ seller_id: string }>(
    `SELECT seller_id
     FROM commissions
     WHERE id = $1`,
    [input.commissionId],
  );

  const commission = commissionResult.rows[0];

  if (
    !commission ||
    (input.userRole !== "admin" &&
      input.userRole !== "finance_admin" &&
      commission.seller_id !== input.userId)
  ) {
    throw new TransactionError(
      404,
      "COMMISSION_NOT_FOUND",
      "Commission not found.",
    );
  }

  const params: unknown[] = [input.commissionId];
  let where = "entity_type = 'commission' AND entity_id = $1";

  if (input.status) {
    params.push(input.status);
    where += ` AND status = $${params.length}`;
  }

  const offset = (input.page - 1) * input.limit;

  const result = await pool.query<DisputeRecord>(
    `SELECT *
     FROM disputes
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, input.limit, offset],
  );

  const totalResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM disputes
     WHERE ${where}`,
    params,
  );

  return {
    items: result.rows,
    page: input.page,
    limit: input.limit,
    total: Number(totalResult.rows[0]?.count ?? 0),
  };
}
