import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../config/database";
import { writeAuditLog } from "../utils/auditLog";

export type TransactionStatus = "submitted" | "verified" | "rejected";

export type TransactionRecord = QueryResultRow & {
  id: string;
  referral_id: string;
  buyer_id: string;
  property_id: string;
  seller_id: string;
  sale_amount: string;
  closing_date: string;
  notes: string | null;
  status: TransactionStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type TransactionDocumentRecord = QueryResultRow & {
  id: string;
  transaction_id: string;
  file_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: Date;
};

export class TransactionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

export async function createTransaction(input: {
  sellerId: string;
  referralId: string;
  saleAmount: number;
  closingDate: string;
  notes?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const referralResult = await client.query<{
      id: string;
      buyer_id: string;
      property_id: string;
      assigned_to: string;
      status: string;
    }>(
      `SELECT id, buyer_id, property_id, assigned_to, status
       FROM referrals
       WHERE id = $1
       FOR UPDATE`,
      [input.referralId],
    );

    const referral = referralResult.rows[0];

    if (!referral) {
      throw new TransactionError(
        404,
        "REFERRAL_NOT_FOUND",
        "Referral not found.",
      );
    }

    if (referral.status !== "closed_won") {
      throw new TransactionError(
        409,
        "REFERRAL_NOT_CLOSED_WON",
        "A transaction can only be submitted for a closed-won referral.",
      );
    }

    if (referral.assigned_to !== input.sellerId) {
      throw new TransactionError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "This referral is not assigned to you.",
      );
    }

    const duplicateResult = await client.query<{ id: string }>(
      `SELECT id
       FROM transactions
       WHERE referral_id = $1
       FOR UPDATE`,
      [input.referralId],
    );

    if ((duplicateResult.rowCount ?? 0) > 0) {
      throw new TransactionError(
        409,
        "DUPLICATE_TRANSACTION",
        "A transaction already exists for this referral.",
      );
    }

    const inserted = await client.query<TransactionRecord>(
      `INSERT INTO transactions
         (referral_id, buyer_id, property_id, seller_id, sale_amount, closing_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, 'submitted')
       RETURNING *`,
      [
        input.referralId,
        referral.buyer_id,
        referral.property_id,
        input.sellerId,
        input.saleAmount,
        input.closingDate,
        input.notes?.trim() || null,
      ],
    );

    const transaction = inserted.rows[0];

    if (!transaction) {
      throw new TransactionError(
        500,
        "TRANSACTION_INSERT_FAILED",
        "Failed to create the transaction.",
      );
    }
    await writeAuditLog(client, {
      actorId: input.sellerId,
      action: "transaction.created",
      entityType: "transaction",
      entityId: transaction.id,
      oldValues: null,
      newValues: {
        referral_id: transaction.referral_id,
        buyer_id: transaction.buyer_id,
        property_id: transaction.property_id,
        seller_id: transaction.seller_id,
        sale_amount: transaction.sale_amount,
        closing_date: transaction.closing_date,
        status: transaction.status,
      },
    });

    await client.query("COMMIT");
    return transaction;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof TransactionError) {
      throw error;
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listTransactions(input: {
  userId: string;
  userRole: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status?: TransactionStatus;
  page: number;
  limit: number;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.userRole === "buyer") {
    conditions.push(`t.buyer_id = $${params.length + 1}`);
    params.push(input.userId);
  } else if (input.userRole === "agent" || input.userRole === "developer") {
    conditions.push(`t.seller_id = $${params.length + 1}`);
    params.push(input.userId);
  }

  if (input.status) {
    conditions.push(`t.status = $${params.length + 1}`);
    params.push(input.status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const offset = (input.page - 1) * input.limit;

  const result = await pool.query<TransactionRecord>(
    `SELECT t.*,
            buyer.full_name AS buyer_name,
            seller.full_name AS seller_name,
            p.title AS property_title
     FROM transactions t
     JOIN users buyer ON buyer.id = t.buyer_id
     JOIN users seller ON seller.id = t.seller_id
     JOIN properties p ON p.id = t.property_id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, input.limit, offset],
  );

  const totalResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM transactions t
     ${whereClause === "" ? "" : `WHERE ${conditions.join(" AND ")}`}
     `,
    params,
  );

  return {
    items: result.rows,
    page: input.page,
    limit: input.limit,
    total: Number(totalResult.rows[0]?.count ?? 0),
  };
}

export async function getTransactionById(input: {
  transactionId: string;
  userId: string;
  userRole: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
}) {
  const result = await pool.query<
    TransactionRecord & {
      buyer_name: string;
      seller_name: string;
      property_title: string;
    }
  >(
    `SELECT t.*,
            buyer.full_name AS buyer_name,
            seller.full_name AS seller_name,
            p.title AS property_title
     FROM transactions t
     JOIN users buyer ON buyer.id = t.buyer_id
     JOIN users seller ON seller.id = t.seller_id
     JOIN properties p ON p.id = t.property_id
     WHERE t.id = $1`,
    [input.transactionId],
  );

  const transaction = result.rows[0];

  if (!transaction) {
    throw new TransactionError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Transaction not found.",
    );
  }

  const isAllowed =
    input.userRole === "admin" ||
    input.userRole === "finance_admin" ||
    transaction.buyer_id === input.userId ||
    transaction.seller_id === input.userId;

  if (!isAllowed) {
    throw new TransactionError(
      403,
      "TRANSACTION_ACCESS_DENIED",
      "You do not have access to this transaction.",
    );
  }

  return transaction;
}

export async function updateTransaction(input: {
  transactionId: string;
  sellerId: string;
  saleAmount?: number;
  closingDate?: string;
  notes?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query<TransactionRecord>(
      `SELECT *
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [input.transactionId],
    );

    const transaction = current.rows[0];

    if (!transaction) {
      throw new TransactionError(
        404,
        "TRANSACTION_NOT_FOUND",
        "Transaction not found.",
      );
    }

    if (transaction.seller_id !== input.sellerId) {
      throw new TransactionError(
        403,
        "TRANSACTION_ACCESS_DENIED",
        "Only the assigned seller can update this transaction.",
      );
    }

    if (
      !(["submitted", "rejected"] as TransactionStatus[]).includes(
        transaction.status,
      )
    ) {
      throw new TransactionError(
        409,
        "TRANSACTION_NOT_EDITABLE",
        "This transaction can no longer be edited.",
      );
    }

    const nextSaleAmount = input.saleAmount ?? Number(transaction.sale_amount);
    const nextClosingDate = input.closingDate ?? transaction.closing_date;
    const nextNotes =
      input.notes === undefined
        ? transaction.notes
        : input.notes?.trim() || null;

    const updated = await client.query<TransactionRecord>(
      `UPDATE transactions
       SET sale_amount = $1,
           closing_date = $2::date,
           notes = $3,
           status = CASE WHEN status = 'rejected' THEN 'submitted' ELSE status END,
           rejection_reason = NULL,
           reviewed_by = NULL,
           reviewed_at = NULL,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [nextSaleAmount, nextClosingDate, nextNotes, input.transactionId],
    );

    const row = updated.rows[0];

    if (!row) {
      throw new TransactionError(
        500,
        "TRANSACTION_UPDATE_FAILED",
        "Failed to update the transaction.",
      );
    }

    await writeAuditLog(client, {
      actorId: input.sellerId,
      action: "transaction.updated",
      entityType: "transaction",
      entityId: row.id,
      oldValues: {
        sale_amount: transaction.sale_amount,
        closing_date: transaction.closing_date,
        notes: transaction.notes,
        status: transaction.status,
        rejection_reason: transaction.rejection_reason,
      },
      newValues: {
        sale_amount: row.sale_amount,
        closing_date: row.closing_date,
        notes: row.notes,
        status: row.status,
        rejection_reason: row.rejection_reason,
      },
    });
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof TransactionError) {
      throw error;
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listTransactionDocuments(transactionId: string) {
  const result = await pool.query<TransactionDocumentRecord>(
    `SELECT *
     FROM transaction_documents
     WHERE transaction_id = $1
     ORDER BY created_at DESC`,
    [transactionId],
  );

  return result.rows;
}

export async function createTransactionDocument(input: {
  transactionId: string;
  sellerId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const transactionResult = await client.query<TransactionRecord>(
      `SELECT *
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [input.transactionId],
    );

    const transaction = transactionResult.rows[0];

    if (!transaction) {
      throw new TransactionError(
        404,
        "TRANSACTION_NOT_FOUND",
        "Transaction not found.",
      );
    }

    if (transaction.seller_id !== input.sellerId) {
      throw new TransactionError(
        403,
        "TRANSACTION_ACCESS_DENIED",
        "Only the assigned seller can upload documents for this transaction.",
      );
    }

    const created = await client.query<TransactionDocumentRecord>(
      `INSERT INTO transaction_documents
         (transaction_id, file_key, file_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.transactionId,
        input.fileKey,
        input.fileName,
        input.mimeType,
        input.sizeBytes,
        input.sellerId,
      ],
    );

    const document = created.rows[0];

    if (!document) {
      throw new TransactionError(
        500,
        "TRANSACTION_DOCUMENT_INSERT_FAILED",
        "Failed to create the transaction document record.",
      );
    }

    await writeAuditLog(client, {
      actorId: input.sellerId,
      action: "transaction.document_uploaded",
      entityType: "transaction",
      entityId: input.transactionId,
      oldValues: null,
      newValues: {
        document_id: document.id,
        file_key: input.fileKey,
      },
    });

    await client.query("COMMIT");
    return document;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof TransactionError) {
      throw error;
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function decideTransaction(input: {
  transactionId: string;
  actorId: string;
  actorRole: "admin" | "finance_admin";
  decision: "verified" | "rejected";
  reason?: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query<TransactionRecord>(
      `SELECT *
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [input.transactionId],
    );

    const transaction = current.rows[0];

    if (!transaction) {
      throw new TransactionError(
        404,
        "TRANSACTION_NOT_FOUND",
        "Transaction not found.",
      );
    }

    if (input.actorRole !== "admin" && input.actorRole !== "finance_admin") {
      throw new TransactionError(
        403,
        "TRANSACTION_DECISION_NOT_ALLOWED",
        "Only admin or finance users can verify or reject a transaction.",
      );
    }

    if (transaction.status !== "submitted") {
      throw new TransactionError(
        409,
        "TRANSACTION_ALREADY_DECIDED",
        "This transaction is no longer pending verification.",
      );
    }

    if (input.decision === "rejected") {
      if (!input.reason?.trim()) {
        throw new TransactionError(
          400,
          "REJECTION_REASON_REQUIRED",
          "A rejection reason is required.",
        );
      }
    }

    const updated = await client.query<TransactionRecord>(
      `UPDATE transactions
       SET status = $1,
           rejection_reason = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        input.decision,
        input.decision === "rejected" ? (input.reason?.trim() ?? null) : null,
        input.actorId,
        input.transactionId,
      ],
    );

    const row = updated.rows[0];

    if (!row) {
      throw new TransactionError(
        500,
        "TRANSACTION_DECISION_FAILED",
        "Failed to update the transaction decision.",
      );
    }

    if (input.decision === "verified") {
      const propertyResult = await client.query<{ status: string }>(
        `SELECT status
   FROM properties
   WHERE id = $1
   FOR UPDATE`,
        [transaction.property_id],
      );

      const previousProperty = propertyResult.rows[0];

      if (previousProperty && previousProperty.status !== "sold") {
        await client.query(
          `UPDATE properties
     SET status = 'sold',
         updated_at = NOW()
     WHERE id = $1`,
          [transaction.property_id],
        );

        await writeAuditLog(client, {
          actorId: input.actorId,
          action: "property.sold",
          entityType: "property",
          entityId: transaction.property_id,
          oldValues: { status: previousProperty.status },
          newValues: {
            status: "sold",
            transaction_id: transaction.id,
          },
        });
      }
      // Find the seller-specific active agreement, falling back to the platform default.
      const agreementResult = await client.query<{
        id: string;
        commission_rate_pct: string;
        platform_share_pct: string;
      }>(
        `SELECT id, commission_rate_pct, platform_share_pct
         FROM commission_agreements
         WHERE effective_to IS NULL
           AND (seller_id = $1 OR seller_id IS NULL)
         ORDER BY
           CASE WHEN seller_id = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [transaction.seller_id],
      );

      const agreement = agreementResult.rows[0];

      if (!agreement) {
        throw new TransactionError(
          409,
          "NO_COMMISSION_TERMS",
          "No active commission agreement exists for this seller or the platform.",
        );
      }

      // Calculate and insert the commission entirely in PostgreSQL.
      const commissionResult = await client.query<{
        id: string;
        sale_amount: string;
        commission_rate_pct: string;
        platform_share_pct: string;
        total_commission: string;
        platform_amount: string;
        seller_amount: string;
      }>(
        `INSERT INTO commissions (
           transaction_id,
           seller_id,
           agreement_id,
           sale_amount,
           commission_rate_pct,
           platform_share_pct,
           total_commission,
           platform_amount,
           seller_amount
         )
         SELECT
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           amounts.total_commission,
           ROUND(
             amounts.total_commission * $6::NUMERIC / 100,
             2
           ),
           amounts.total_commission - ROUND(
             amounts.total_commission * $6::NUMERIC / 100,
             2
           )
         FROM (
           SELECT ROUND(
             $4::NUMERIC * $5::NUMERIC / 100,
             2
           ) AS total_commission
         ) AS amounts
         RETURNING
           id,
           sale_amount,
           commission_rate_pct,
           platform_share_pct,
           total_commission,
           platform_amount,
           seller_amount`,
        [
          transaction.id,
          transaction.seller_id,
          agreement.id,
          transaction.sale_amount,
          agreement.commission_rate_pct,
          agreement.platform_share_pct,
        ],
      );

      const commission = commissionResult.rows[0];

      if (!commission) {
        throw new TransactionError(
          500,
          "COMMISSION_CREATION_FAILED",
          "Failed to create the transaction commission.",
        );
      }
      await writeAuditLog(client, {
        actorId: input.actorId,
        action: "commission.created",
        entityType: "commission",
        entityId: commission.id,
        oldValues: null,
        newValues: {
          transaction_id: transaction.id,
          seller_id: transaction.seller_id,
          agreement_id: agreement.id,
          sale_amount: commission.sale_amount,
          commission_rate_pct: commission.commission_rate_pct,
          platform_share_pct: commission.platform_share_pct,
          total_commission: commission.total_commission,
          platform_amount: commission.platform_amount,
          seller_amount: commission.seller_amount,
        },
      });
    }
    await writeAuditLog(client, {
      actorId: input.actorId,
      action:
        input.decision === "verified"
          ? "transaction.verified"
          : "transaction.rejected",
      entityType: "transaction",
      entityId: row.id,
      oldValues: {
        status: transaction.status,
        rejection_reason: transaction.rejection_reason,
        reviewed_by: transaction.reviewed_by,
        reviewed_at: transaction.reviewed_at,
      },
      newValues: {
        status: row.status,
        rejection_reason: row.rejection_reason,
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
      },
    });

    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof TransactionError) {
      throw error;
    }

    throw error;
  } finally {
    client.release();
  }
}
