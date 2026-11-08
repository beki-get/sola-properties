import type { PoolClient } from "pg";
import { withTransaction } from "../utils/withTransaction";
import { pool } from "../config/database";
import { createNotification } from "./notificationQueries";

export class CommissionAgreementError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommissionAgreementError";
  }
}

export async function createCommissionAgreement(input: {
  sellerId?: string;
  commissionRatePct: number;
  platformSharePct: number;
  actorId: string;
}) {
  return withTransaction(async (client: PoolClient) => {
    if (input.sellerId) {
      const sellerResult = await client.query(
        `SELECT id
         FROM users
         WHERE id = $1
           AND role IN ('agent', 'developer')
           AND status = 'approved'
         FOR SHARE`,
        [input.sellerId],
      );

      if (sellerResult.rowCount === 0) {
        throw new CommissionAgreementError(
          404,
          "APPROVED_SELLER_NOT_FOUND",
          "The approved seller was not found.",
        );
      }
    }

    // Close the currently active agreement for this seller or platform default.
    await client.query(
      `UPDATE commission_agreements
       SET effective_to = NOW()
       WHERE seller_id IS NOT DISTINCT FROM $1
         AND effective_to IS NULL`,
      [input.sellerId ?? null],
    );

    const result = await client.query(
      `INSERT INTO commission_agreements (
         seller_id,
         commission_rate_pct,
         platform_share_pct,
         created_by
       )
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         seller_id,
         commission_rate_pct,
         platform_share_pct,
         effective_from,
         effective_to,
         created_by,
         created_at`,
      [
        input.sellerId ?? null,
        input.commissionRatePct,
        input.platformSharePct,
        input.actorId,
      ],
    );

    const agreement = result.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_id,
         action,
         entity_type,
         entity_id,
         old_values,
         new_values
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.actorId,
        "commission_agreement.created",
        "commission_agreement",
        agreement.id,
        null,
        JSON.stringify({
          seller_id: agreement.seller_id,
          commission_rate_pct: agreement.commission_rate_pct,
          platform_share_pct: agreement.platform_share_pct,
          effective_from: agreement.effective_from,
        }),
      ],
    );

    return agreement;
  });
}

export async function getCommissionAgreements(input: {
  sellerId?: string;
  page: number;
  limit: number;
}) {
  const offset = (input.page - 1) * input.limit;

  const values: (string | number)[] = [];
  let whereClause = "";

  if (input.sellerId) {
    values.push(input.sellerId);
    whereClause = "WHERE seller_id = $1";
  }

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total
     FROM commission_agreements
     ${whereClause}`,
    values,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);

  const result = await pool.query(
    `SELECT
       id,
       seller_id,
       commission_rate_pct,
       platform_share_pct,
       effective_from,
       effective_to,
       created_by,
       created_at
     FROM commission_agreements
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, input.limit, offset],
  );

  return {
    items: result.rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
export async function getCommissions(input: {
  sellerId?: string;
  status?: "pending" | "approved" | "paid";
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}) {
  const values: (string | number)[] = [];
  const conditions: string[] = [];

  if (input.sellerId) {
    values.push(input.sellerId);
    conditions.push(`c.seller_id = $${values.length}`);
  }

  if (input.status) {
    values.push(input.status);
    conditions.push(`c.status = $${values.length}`);
  }

  if (input.dateFrom) {
    values.push(input.dateFrom);
    conditions.push(`c.created_at >= $${values.length}::date`);
  }

  if (input.dateTo) {
    values.push(input.dateTo);
    conditions.push(
      `c.created_at < ($${values.length}::date + INTERVAL '1 day')`,
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const limitPosition = values.length + 1;
  const offsetPosition = values.length + 2;
  const offset = (input.page - 1) * input.limit;

  const result = await pool.query(
    `WITH filtered AS (
       SELECT c.*
       FROM commissions c
       ${whereClause}
     ),
     payment_totals AS (
       SELECT
         cp.commission_id,
         SUM(cp.amount) AS paid_total
       FROM commission_payments cp
       JOIN filtered f ON f.id = cp.commission_id
       GROUP BY cp.commission_id
     ),
     adjustment_totals AS (
       SELECT
         ca.commission_id,
         SUM(ca.amount) AS adjustment_total
       FROM commission_adjustments ca
       JOIN filtered f ON f.id = ca.commission_id
       GROUP BY ca.commission_id
     ),
     commission_balances AS (
       SELECT
         f.*,
         COALESCE(at.adjustment_total, 0) AS adjustment_total,
         COALESCE(pt.paid_total, 0) AS paid_total,
         f.platform_amount + COALESCE(at.adjustment_total, 0)
           AS amount_owed,
         f.platform_amount
           + COALESCE(at.adjustment_total, 0)
           - COALESCE(pt.paid_total, 0)
           AS outstanding
       FROM filtered f
       LEFT JOIN payment_totals pt ON pt.commission_id = f.id
       LEFT JOIN adjustment_totals at ON at.commission_id = f.id
     ),
     summary AS (
       SELECT
         COALESCE(SUM(total_commission), 0)::numeric(14,2)::text
           AS total_commission,
         COALESCE(SUM(platform_amount), 0)::numeric(14,2)::text
           AS platform_amount,
         COALESCE(SUM(adjustment_total), 0)::numeric(14,2)::text
           AS adjustment_total,
         COALESCE(SUM(amount_owed), 0)::numeric(14,2)::text
           AS amount_owed,
         COALESCE(SUM(paid_total), 0)::numeric(14,2)::text
           AS paid_total,
         COALESCE(SUM(outstanding), 0)::numeric(14,2)::text
           AS outstanding
       FROM commission_balances
     )
     SELECT
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', page_data.id,
               'transactionId', page_data.transaction_id,
               'sellerId', page_data.seller_id,
               'agreementId', page_data.agreement_id,
               'saleAmount', page_data.sale_amount::text,
               'commissionRatePct', page_data.commission_rate_pct::text,
               'platformSharePct', page_data.platform_share_pct::text,
               'totalCommission', page_data.total_commission::text,
               'platformAmount', page_data.platform_amount::text,
               'sellerAmount', page_data.seller_amount::text,
               'adjustmentTotal', page_data.adjustment_total::text,
               'amountOwed', page_data.amount_owed::text,
               'paidTotal', page_data.paid_total::text,
               'outstanding', page_data.outstanding::text,
               'status', page_data.status,
               'createdAt', page_data.created_at
             )
             ORDER BY page_data.created_at DESC
           )
           FROM (
             SELECT *
             FROM commission_balances
             ORDER BY created_at DESC, id DESC
             LIMIT $${limitPosition}
             OFFSET $${offsetPosition}
           ) page_data
         ),
         '[]'::json
       ) AS items,
       (SELECT row_to_json(summary) FROM summary) AS summary,
       (SELECT COUNT(*)::int FROM filtered) AS total`,
    [...values, input.limit, offset],
  );

  const row = result.rows[0];

  return {
    items: row.items,
    summary: row.summary,
    total: row.total,
  };
}

export async function getCommissionStatement(
  commissionId: string,
  sellerId?: string,
) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.transaction_id,
       c.seller_id,
       c.agreement_id,
       c.sale_amount::text,
       c.commission_rate_pct::text,
       c.platform_share_pct::text,
       c.total_commission::text,
       c.platform_amount::text,
       c.seller_amount::text,
       c.status,
       c.approved_by,
       c.approved_at,
       c.created_at,
       p.title AS property_title,
       r.reference_code,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', cp.id,
               'amount', cp.amount::text,
               'paidOn', cp.paid_on,
               'reference', cp.reference,
               'recordedBy', cp.recorded_by,
               'createdAt', cp.created_at
             )
             ORDER BY cp.created_at DESC
           )
           FROM commission_payments cp
           WHERE cp.commission_id = c.id
         ),
         '[]'::json
       ) AS payments,
       COALESCE(
         (
           SELECT SUM(ca.amount)
           FROM commission_adjustments ca
           WHERE ca.commission_id = c.id
         ),
         0
       )::numeric(14,2)::text AS adjustment_total,
       (
         c.platform_amount + COALESCE(
           (
             SELECT SUM(ca.amount)
             FROM commission_adjustments ca
             WHERE ca.commission_id = c.id
           ),
           0
         )
       )::numeric(14,2)::text AS amount_owed,
       COALESCE(
         (
           SELECT SUM(cp.amount)
           FROM commission_payments cp
           WHERE cp.commission_id = c.id
         ),
         0
       )::numeric(14,2)::text AS paid_total,
       (
         c.platform_amount
         + COALESCE(
           (
             SELECT SUM(ca.amount)
             FROM commission_adjustments ca
             WHERE ca.commission_id = c.id
           ),
           0
         )
         - COALESCE(
           (
             SELECT SUM(cp.amount)
             FROM commission_payments cp
             WHERE cp.commission_id = c.id
           ),
           0
         )
       )::numeric(14,2)::text AS outstanding
     FROM commissions c
     JOIN transactions t ON t.id = c.transaction_id
     JOIN properties p ON p.id = t.property_id
     JOIN referrals r ON r.id = t.referral_id
     WHERE c.id = $1
       AND ($2::uuid IS NULL OR c.seller_id = $2)`,
    [commissionId, sellerId ?? null],
  );

  return result.rows[0] ?? null;
}

export async function approveCommission(commissionId: string, actorId: string) {
  return withTransaction(async (client: PoolClient) => {
    const commissionResult = await client.query(
      `SELECT id, seller_id, status
       FROM commissions
       WHERE id = $1
       FOR UPDATE`,
      [commissionId],
    );

    const commission = commissionResult.rows[0];

    if (!commission) {
      throw new CommissionAgreementError(
        404,
        "COMMISSION_NOT_FOUND",
        "Commission not found.",
      );
    }

    if (commission.status !== "pending") {
      throw new CommissionAgreementError(
        409,
        "COMMISSION_NOT_PENDING",
        "Only pending commissions can be approved.",
      );
    }

    const result = await client.query(
      `UPDATE commissions
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [commissionId, actorId],
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor_id, action, entity_type, entity_id, old_values, new_values
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        "commission.approved",
        "commission",
        commissionId,
        JSON.stringify({ status: "pending" }),
        JSON.stringify({ status: "approved" }),
      ],
    );

    return {
      commission: result.rows[0],
      sellerId: commission.seller_id,
    };
  });
}

export async function recordCommissionPayment(input: {
  commissionId: string;
  amount: string;
  paidOn: string;
  reference?: string;
  actorId: string;
}) {
  return withTransaction(async (client: PoolClient) => {
    const commissionResult = await client.query(
      `SELECT id, seller_id, status, platform_amount
       FROM commissions
       WHERE id = $1
       FOR UPDATE`,
      [input.commissionId],
    );

    const commission = commissionResult.rows[0];

    if (!commission) {
      throw new CommissionAgreementError(
        404,
        "COMMISSION_NOT_FOUND",
        "Commission not found.",
      );
    }

    if (commission.status !== "approved") {
      throw new CommissionAgreementError(
        409,
        "COMMISSION_NOT_APPROVED",
        "Only approved commissions can receive payments.",
      );
    }

    const totalsResult = await client.query(
      `SELECT
         COALESCE(
           (
             SELECT SUM(amount)
             FROM commission_adjustments
             WHERE commission_id = $1
           ),
           0
         ) AS adjustment_total,
         COALESCE(
           (
             SELECT SUM(amount)
             FROM commission_payments
             WHERE commission_id = $1
           ),
           0
         ) AS paid_total`,
      [input.commissionId],
    );

    const totals = totalsResult.rows[0];

    const balanceResult = await client.query(
      `SELECT
         $1::numeric + $2::numeric AS amount_owed,
         $1::numeric + $2::numeric - $3::numeric AS outstanding`,
      [commission.platform_amount, totals.adjustment_total, totals.paid_total],
    );

    const { amount_owed, outstanding } = balanceResult.rows[0];

    const paymentResult = await client.query(
      `INSERT INTO commission_payments (
         commission_id, amount, paid_on, reference, recorded_by
       )
       SELECT $1, $2::numeric, $3::date, $4, $5
       WHERE
         $6::numeric + $2::numeric <= $7::numeric
       RETURNING *`,
      [
        input.commissionId,
        input.amount,
        input.paidOn,
        input.reference ?? null,
        input.actorId,
        totals.paid_total,
        amount_owed,
      ],
    );

    if (!paymentResult.rows[0]) {
      throw new CommissionAgreementError(
        409,
        "PAYMENT_EXCEEDS_OUTSTANDING",
        "Payment exceeds the outstanding platform commission.",
      );
    }

    const updatedTotalsResult = await client.query(
      `SELECT
         COALESCE(SUM(amount), 0)::numeric(14,2)::text AS paid_total,
         (
           $2::numeric - COALESCE(SUM(amount), 0)
         )::numeric(14,2)::text AS outstanding,
         (
           $2::numeric - COALESCE(SUM(amount), 0)
         ) = 0 AS is_fully_paid
       FROM commission_payments
       WHERE commission_id = $1`,
      [input.commissionId, amount_owed],
    );

    const updatedTotals = updatedTotalsResult.rows[0];

    await client.query(
      `UPDATE commissions
       SET status = CASE
         WHEN $2::boolean THEN 'paid'
         ELSE 'approved'
       END
       WHERE id = $1`,
      [input.commissionId, updatedTotals.is_fully_paid],
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor_id, action, entity_type, entity_id, old_values, new_values
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.actorId,
        "commission.payment_recorded",
        "commission",
        input.commissionId,
        JSON.stringify({
          amount_owed,
          paid_total: totals.paid_total,
          outstanding,
        }),
        JSON.stringify({
          payment_id: paymentResult.rows[0].id,
          amount: input.amount,
          paid_on: input.paidOn,
          paid_total: updatedTotals.paid_total,
          outstanding: updatedTotals.outstanding,
        }),
      ],
    );

    return {
      payment: paymentResult.rows[0],
      amountOwed: amount_owed,
      paidTotal: updatedTotals.paid_total,
      outstanding: updatedTotals.outstanding,
      sellerId: commission.seller_id,
    };
  });
}

//commission adjustment function
export async function createCommissionAdjustment(
  commissionId: string,
  createdBy: string,
  amount: string,
  reason: string,
) {
  return withTransaction(async (client) => {
    const commissionResult = await client.query(
      `SELECT id, seller_id, platform_amount
       FROM commissions
       WHERE id = $1
       FOR UPDATE`,
      [commissionId],
    );

    if (commissionResult.rows.length === 0) {
      throw new CommissionAgreementError(
        404,
        "COMMISSION_NOT_FOUND",
        "Commission not found.",
      );
    }

    const commission = commissionResult.rows[0];

    const totalsResult = await client.query(
      `SELECT
         COALESCE(
           (SELECT SUM(amount)
            FROM commission_adjustments
            WHERE commission_id = $1),
           0
         ) AS adjustment_total,
         COALESCE(
           (SELECT SUM(amount)
            FROM commission_payments
            WHERE commission_id = $1),
           0
         ) AS paid_total`,
      [commissionId],
    );

    const totals = totalsResult.rows[0];
    const balanceResult = await client.query(
      `SELECT
     $1::numeric + $2::numeric AS current_owed,
     $1::numeric + $2::numeric + $3::numeric AS new_owed`,
      [commission.platform_amount, totals.adjustment_total, amount],
    );

    const { current_owed, new_owed } = balanceResult.rows[0];

    const safetyResult = await client.query(
      `SELECT
         $1::numeric >= 0
         AND $1::numeric >= $2::numeric AS is_valid`,
      [new_owed, totals.paid_total],
    );

    if (!safetyResult.rows[0].is_valid) {
      throw new CommissionAgreementError(
        409,
        "INVALID_COMMISSION_ADJUSTMENT",
        "Adjustment cannot reduce the amount owed below zero or below the amount already paid.",
      );
    }

    const adjustmentResult = await client.query(
      `INSERT INTO commission_adjustments
         (commission_id, amount, reason, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, commission_id, amount, reason, created_by, created_at`,
      [commissionId, amount, reason, createdBy],
    );

    const adjustment = adjustmentResult.rows[0];

    // CHECK: Match the audit_logs column names and action naming
    // used by your existing commission approval/payment queries.
    await client.query(
      `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        createdBy,
        "commission.adjustment_created",
        "commission",
        commissionId,
        JSON.stringify({ amount_owed: current_owed }),
        JSON.stringify({
          adjustment_id: adjustment.id,
          adjustment_amount: amount,
          reason,
          amount_owed: new_owed,
        }),
      ],
    );

    // A positive adjustment may reopen a previously paid commission.
    // A commission is paid only when its payments equal the adjusted amount.
    await client.query(
      `UPDATE commissions
   SET status = CASE
     WHEN status = 'pending' THEN 'pending'
     WHEN $2::numeric = $3::numeric THEN 'paid'
     ELSE 'approved'
   END
   WHERE id = $1`,
      [commissionId, new_owed, totals.paid_total],
    );

    return {
      adjustment,
      sellerId: commission.seller_id,
      amountOwed: new_owed,
    };
  });
}
