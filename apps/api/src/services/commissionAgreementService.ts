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
import { logger } from "../utils/logger";

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
  const result = await approveCommission(commissionId, actorId);

  try {
    await notifyUser({
      recipientId: result.sellerId,
      type: "commission_approved",
      title: "Commission approved",
      message: "Your commission has been approved.",
      entityType: "commission",
      entityId: commissionId,
    });
  } catch (error) {
    logger.error(
      { err: error, commissionId },
      "Failed to create commission approval notification",
    );
  }

  return result.commission;
}

export async function recordCommissionPaymentService(input: {
  commissionId: string;
  amount: string;
  paidOn: string;
  reference?: string;
  actorId: string;
}) {
  const result = await recordCommissionPayment(input);

  try {
    await notifyUser({
      recipientId: result.sellerId,
      type: "commission_payment_recorded",
      title: "Commission payment recorded",
      message: "A payment has been recorded against your commission.",
      entityType: "commission",
      entityId: input.commissionId,
    });
  } catch (error) {
    logger.error(
      { err: error, commissionId: input.commissionId },
      "Failed to create commission payment notification",
    );
  }

  const { sellerId: _sellerId, ...response } = result;
  return response;
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

  let notificationSent = false;

  try {
    const notification = await notifyUser({
      recipientId: result.sellerId,
      type: "commission_adjustment",
      title: "Commission adjusted",
      message: `Your commission amount owed has been adjusted. New amount owed: ${result.amountOwed}.`,
      entityType: "commission",
      entityId: commissionId,
    });

    notificationSent = Boolean(notification);
  } catch (error) {
    logger.error(
      { err: error, commissionId },
      "Failed to create commission adjustment notification",
    );
  }

  return {
    ...result.adjustment,
    amountOwed: result.amountOwed,
    notificationSent,
  };
}
