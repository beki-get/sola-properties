import {
  createCommissionAgreement,
  getCommissionAgreements,
  getCommissions,
  getCommissionStatement,
  approveCommission,
  recordCommissionPayment,
  createCommissionAdjustment as insertCommissionAdjustment,
} from "../queries/commissionAgreementQueries";

import { notifyUser } from "./notificationService";
export async function createCommissionAgreementService(input: {
  sellerId?: string;
  commissionRatePct: number;
  platformSharePct: number;
  actorId: string;
}) {
  return createCommissionAgreement(input);
}

export async function getCommissionAgreementsService(input: {
  sellerId?: string;
  page: number;
  limit: number;
}) {
  return getCommissionAgreements(input);
}

export async function getCommissionsService(input: {
  sellerId?: string;
  status?: "pending" | "approved" | "paid";
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}) {
  return getCommissions(input);
}

export async function getCommissionStatementService(
  commissionId: string,
  sellerId?: string,
) {
  return getCommissionStatement(commissionId, sellerId);
}

export async function approveCommissionService(
  commissionId: string,
  actorId: string,
) {
  return approveCommission(commissionId, actorId);
}

export async function recordCommissionPaymentService(input: {
  commissionId: string;
  amount: string;
  paidOn: string;
  reference?: string;
  actorId: string;
}) {
  return recordCommissionPayment(input);
}

export async function createCommissionAdjustment(
  commissionId: string,
  createdBy: string,
  amount: string,
  reason: string,
) {
  const result = await insertCommissionAdjustment(
    commissionId,
    createdBy,
    amount,
    reason,
  );

  // Notification failure must not undo a committed financial adjustment.
  const notification = await notifyUser({
    recipientId: result.sellerId,
    type: "commission_adjustment",
    title: "Commission adjusted",
    message: `Your commission amount owed has been adjusted. New amount owed: ${result.amountOwed}.`,
    entityType: "commission",
    entityId: commissionId,
  }).catch(() => null);

  return {
    ...result.adjustment,
    amountOwed: result.amountOwed,
    notificationSent: Boolean(notification),
  };
}
