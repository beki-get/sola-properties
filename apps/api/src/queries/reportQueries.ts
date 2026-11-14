
import { pool } from "../config/database";

export type ReportRole = "agent" | "developer" | "admin" | "finance_admin";

export interface StatusCountRow {
  status: string;
  count: string;
}

export interface PropertyReportSection {
  total: number;
  byStatus: Record<string, number>;
}

export interface ReferralReportSection {
  total: number;
  byStatus: Record<string, number>;
}

export interface SalesReportSection {
  totalSalesCount: number;
  totalSalesValue: string;
}

export interface CommissionReportSection {
  totalCommission: string;
  sellerEarnings: string;
  adjustments: string;
  amountPaid: string;
  outstandingAmount: string;
}

export interface AgentReportData {
  properties: PropertyReportSection;
  referrals: ReferralReportSection;
  sales: SalesReportSection;
  commissions: CommissionReportSection;
  authorizedProperties: {
    total: number;
  };
}

export interface DeveloperReportData {
  totalProjects: number;
  totalProperties: number;
  authorizedAgents: number;
  referrals: ReferralReportSection;
}

export interface AdminReportData {
  properties: PropertyReportSection;
  referrals: ReferralReportSection;
  sales: SalesReportSection;
  commissions: CommissionReportSection;
  users: {
    total: number;
  };
  pendingVerifications: {
    total: number;
  };
}

export interface FinanceAdminReportData {
  sales: SalesReportSection;
  commissions: CommissionReportSection;
}

function toStatusMap(rows: StatusCountRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = Number(row.count ?? 0);
    return acc;
  }, {});
}

function getStatusTotal(rows: StatusCountRow[]): number {
  return rows.reduce((total, row) => total + Number(row.count ?? 0), 0);
}

export async function getAgentReport(
  agentId: string,
): Promise<AgentReportData> {
  const [
    propertyRows,
    referralRows,
    salesRows,
    authorizedPropertiesRows,
    commissionRows,
  ] = await Promise.all([
    pool.query<StatusCountRow>(
      `SELECT p.status, COUNT(*)::text AS count
       FROM properties p
       WHERE p.owner_id = $1
       GROUP BY p.status
       ORDER BY p.status`,
      [agentId],
    ),

    pool.query<StatusCountRow>(
      `SELECT r.status, COUNT(*)::text AS count
       FROM referrals r
       WHERE r.assigned_to = $1
       GROUP BY r.status
       ORDER BY r.status`,
      [agentId],
    ),

    pool.query<{
      total_sales_count: string;
      total_sales_value: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_sales_count,
         COALESCE(SUM(t.sale_amount), 0)::numeric(14,2)::text AS total_sales_value
       FROM transactions t
       WHERE t.seller_id = $1
         AND t.status = 'verified'`,
      [agentId],
    ),

    pool.query<{ total: string }>(
      `SELECT COUNT(DISTINCT p.id)::text AS total
       FROM property_authorizations paa
       JOIN properties p ON p.id = paa.property_id
       WHERE paa.agent_id = $1
         AND paa.status = 'active'
         AND p.status = 'active'`,
      [agentId],
    ),

    pool.query<{
      total_commission: string;
      seller_earnings: string;
      adjustment_total: string;
      amount_paid: string;
      outstanding_amount: string;
    }>(
      `WITH commission_totals AS (
         SELECT
           COALESCE(SUM(c.total_commission), 0)::numeric(14,2) AS total_commission,
           COALESCE(SUM(c.seller_amount), 0)::numeric(14,2) AS seller_earnings,
           COALESCE(SUM(c.platform_amount), 0)::numeric(14,2) AS platform_amount,
           COALESCE(
             (
               SELECT SUM(ca.amount)
               FROM commission_adjustments ca
               JOIN commissions c2 ON c2.id = ca.commission_id
               WHERE c2.seller_id = $1
             ),
             0
           )::numeric(14,2) AS adjustment_total,
           COALESCE(
             (
               SELECT SUM(cp.amount)
               FROM commission_payments cp
               JOIN commissions c3 ON c3.id = cp.commission_id
               WHERE c3.seller_id = $1
             ),
             0
           )::numeric(14,2) AS amount_paid
         FROM commissions c
         WHERE c.seller_id = $1
       )
       SELECT
         total_commission::text,
         seller_earnings::text,
         adjustment_total::text,
         amount_paid::text,
         (
           platform_amount + adjustment_total - amount_paid
         )::numeric(14,2)::text AS outstanding_amount
       FROM commission_totals`,
      [agentId],
    ),
  ]);

  const salesRow = salesRows.rows[0] ?? {
    total_sales_count: "0",
    total_sales_value: "0",
  };

  const commissionRow = commissionRows.rows[0] ?? {
    total_commission: "0",
    seller_earnings: "0",
    adjustment_total: "0",
    amount_paid: "0",
    outstanding_amount: "0",
  };

  return {
    properties: {
      total: getStatusTotal(propertyRows.rows),
      byStatus: toStatusMap(propertyRows.rows),
    },

    referrals: {
      total: getStatusTotal(referralRows.rows),
      byStatus: toStatusMap(referralRows.rows),
    },

    sales: {
      totalSalesCount: Number(salesRow.total_sales_count ?? 0),
      totalSalesValue: salesRow.total_sales_value ?? "0",
    },

    commissions: {
      totalCommission: commissionRow.total_commission ?? "0",
      sellerEarnings: commissionRow.seller_earnings ?? "0",
      adjustments: commissionRow.adjustment_total ?? "0",
      amountPaid: commissionRow.amount_paid ?? "0",
      outstandingAmount: commissionRow.outstanding_amount ?? "0",
    },

    authorizedProperties: {
      total: Number(authorizedPropertiesRows.rows[0]?.total ?? 0),
    },
  };
}

export async function getDeveloperReport(
  developerId: string,
): Promise<DeveloperReportData> {
  const [result, referralRows] = await Promise.all([
    pool.query<{
      total_projects: string;
      total_properties: string;
      authorized_agents: string;
    }>(
      `SELECT
         (
           SELECT COUNT(*)::text
           FROM projects
           WHERE developer_id = $1
         ) AS total_projects,
         (
           SELECT COUNT(*)::text
           FROM properties
           WHERE owner_id = $1
         ) AS total_properties,
         (
           SELECT COUNT(DISTINCT pa.agent_id)::text
           FROM property_authorizations pa
           JOIN properties p ON p.id = pa.property_id
           WHERE p.owner_id = $1
             AND p.status = 'active'
             AND pa.status = 'active'
         ) AS authorized_agents`,
      [developerId],
    ),

    pool.query<StatusCountRow>(
      `SELECT r.status, COUNT(*)::text AS count
       FROM referrals r
       WHERE r.assigned_to = $1
       GROUP BY r.status
       ORDER BY r.status`,
      [developerId],
    ),
  ]);

  const row = result.rows[0] ?? {
    total_projects: "0",
    total_properties: "0",
    authorized_agents: "0",
  };

  return {
    totalProjects: Number(row.total_projects ?? 0),
    totalProperties: Number(row.total_properties ?? 0),
    authorizedAgents: Number(row.authorized_agents ?? 0),

    referrals: {
      total: getStatusTotal(referralRows.rows),
      byStatus: toStatusMap(referralRows.rows),
    },
  };
}

export async function getAdminReport(): Promise<AdminReportData> {
  const [propertyRows, referralRows, salesRows, commissionRows] =
    await Promise.all([
      pool.query<StatusCountRow>(
        `SELECT p.status, COUNT(*)::text AS count
         FROM properties p
         GROUP BY p.status
         ORDER BY p.status`,
      ),

      pool.query<StatusCountRow>(
        `SELECT r.status, COUNT(*)::text AS count
         FROM referrals r
         GROUP BY r.status
         ORDER BY r.status`,
      ),

      pool.query<{
        total_sales_count: string;
        total_sales_value: string;
      }>(
        `SELECT
           COUNT(*)::text AS total_sales_count,
           COALESCE(SUM(t.sale_amount), 0)::numeric(14,2)::text AS total_sales_value
         FROM transactions t
         WHERE t.status = 'verified'`,
      ),

      pool.query<{
        total_commission: string;
        seller_earnings: string;
        adjustment_total: string;
        amount_paid: string;
        outstanding_amount: string;
      }>(
        `WITH commission_totals AS (
           SELECT
             COALESCE(SUM(c.total_commission), 0)::numeric(14,2) AS total_commission,
             COALESCE(SUM(c.seller_amount), 0)::numeric(14,2) AS seller_earnings,
             COALESCE(SUM(c.platform_amount), 0)::numeric(14,2) AS platform_amount,
             COALESCE(
               (SELECT SUM(ca.amount) FROM commission_adjustments ca),
               0
             )::numeric(14,2) AS adjustment_total,
             COALESCE(
               (SELECT SUM(cp.amount) FROM commission_payments cp),
               0
             )::numeric(14,2) AS amount_paid
           FROM commissions c
         )
         SELECT
           total_commission::text,
           seller_earnings::text,
           adjustment_total::text,
           amount_paid::text,
           (
             platform_amount + adjustment_total - amount_paid
           )::numeric(14,2)::text AS outstanding_amount
         FROM commission_totals`,
      ),
    ]);

  const [pendingVerificationsResult, totalUsersResult] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM account_verification_requests
       WHERE status = 'pending'`,
    ),

    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM users`,
    ),
  ]);

  const salesRow = salesRows.rows[0];
  const commissionRow = commissionRows.rows[0];

  return {
    properties: {
      total: getStatusTotal(propertyRows.rows),
      byStatus: toStatusMap(propertyRows.rows),
    },

    referrals: {
      total: getStatusTotal(referralRows.rows),
      byStatus: toStatusMap(referralRows.rows),
    },

    sales: {
      totalSalesCount: Number(salesRow?.total_sales_count ?? 0),
      totalSalesValue: salesRow?.total_sales_value ?? "0",
    },

    commissions: {
      totalCommission: commissionRow?.total_commission ?? "0",
      sellerEarnings: commissionRow?.seller_earnings ?? "0",
      adjustments: commissionRow?.adjustment_total ?? "0",
      amountPaid: commissionRow?.amount_paid ?? "0",
      outstandingAmount: commissionRow?.outstanding_amount ?? "0",
    },

    users: {
      total: Number(totalUsersResult.rows[0]?.total ?? 0),
    },

    pendingVerifications: {
      total: Number(pendingVerificationsResult.rows[0]?.total ?? 0),
    },
  };
}

export async function getFinanceAdminReport(): Promise<FinanceAdminReportData> {
  const [salesResult, commissionResult] = await Promise.all([
    pool.query<{
      total_sales_count: string;
      total_sales_value: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_sales_count,
         COALESCE(SUM(t.sale_amount), 0)::numeric(14,2)::text AS total_sales_value
       FROM transactions t
       WHERE t.status = 'verified'`,
    ),

    pool.query<{
      total_commission: string;
      seller_earnings: string;
      adjustment_total: string;
      amount_paid: string;
      outstanding_amount: string;
    }>(
      `WITH commission_totals AS (
         SELECT
           COALESCE(SUM(c.total_commission), 0)::numeric(14,2) AS total_commission,
           COALESCE(SUM(c.seller_amount), 0)::numeric(14,2) AS seller_earnings,
           COALESCE(SUM(c.platform_amount), 0)::numeric(14,2) AS platform_amount,
           COALESCE(
             (SELECT SUM(ca.amount) FROM commission_adjustments ca),
             0
           )::numeric(14,2) AS adjustment_total,
           COALESCE(
             (SELECT SUM(cp.amount) FROM commission_payments cp),
             0
           )::numeric(14,2) AS amount_paid
         FROM commissions c
       )
       SELECT
         total_commission::text,
         seller_earnings::text,
         adjustment_total::text,
         amount_paid::text,
         (
           platform_amount + adjustment_total - amount_paid
         )::numeric(14,2)::text AS outstanding_amount
       FROM commission_totals`,
    ),
  ]);

  const salesRow = salesResult.rows[0];
  const commissionRow = commissionResult.rows[0];

  return {
    sales: {
      totalSalesCount: Number(salesRow?.total_sales_count ?? 0),
      totalSalesValue: salesRow?.total_sales_value ?? "0",
    },

    commissions: {
      totalCommission: commissionRow?.total_commission ?? "0",
      sellerEarnings: commissionRow?.seller_earnings ?? "0",
      adjustments: commissionRow?.adjustment_total ?? "0",
      amountPaid: commissionRow?.amount_paid ?? "0",
      outstandingAmount: commissionRow?.outstanding_amount ?? "0",
    },
  };
}
