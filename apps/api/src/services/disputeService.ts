import {
  createTransactionDispute as insertTransactionDispute,
  createCommissionDispute as insertCommissionDispute,
  decideTransactionDispute as reviewDispute,
  listTransactionDisputes as fetchTransactionDisputes,
  listCommissionDisputes as fetchCommissionDisputes,
  getDisputeAdminRecipients,
} from "../queries/disputeQueries";
import { notifyUser } from "./notificationService";

export async function openTransactionDispute(input: {
  transactionId: string;
  actorId: string;
  actorRole: string;
  reason: string;
}) {
  return insertTransactionDispute(input);
}

export async function openCommissionDispute(input: {
  commissionId: string;
  actorId: string;
  reason: string;
}) {
  const dispute = await insertCommissionDispute(input);

  const adminIds = await getDisputeAdminRecipients();

  const notifications = await Promise.allSettled(
    adminIds.map((recipientId) =>
      notifyUser({
        recipientId,
        type: "commission_dispute_opened",
        title: "New commission dispute",
        message: `A seller has opened a commission dispute. Reason: ${dispute.reason}`,
        entityType: "commission",
        entityId: input.commissionId,
      }),
    ),
  );

  return {
    dispute,
    notificationsCreated: notifications.filter(
      (item) => item.status === "fulfilled",
    ).length,
  };
}

export async function getTransactionDisputes(input: {
  transactionId: string;
  userId: string;
  userRole: string;
  status?: "open" | "resolved" | "rejected";
  page: number;
  limit: number;
}) {
  return fetchTransactionDisputes(input);
}

export async function getCommissionDisputes(input: {
  commissionId: string;
  userId: string;
  userRole: string;
  status?: "open" | "resolved" | "rejected";
  page: number;
  limit: number;
}) {
  return fetchCommissionDisputes(input);
}

export async function decideTransactionDispute(input: {
  disputeId: string;
  actorId: string;
  actorRole: string;
  decision: "resolved" | "rejected";
  resolutionNote: string;
}) {
  const result = await reviewDispute(input);

  const entityLabel =
    result.dispute.entity_type === "commission"
      ? "Commission"
      : "Transaction";

  const decisionText = input.decision;

  const recipients = result.buyerId
    ? [result.buyerId, result.sellerId]
    : [result.sellerId];

  const notificationResults = await Promise.allSettled(
    recipients.map((recipientId) =>
      notifyUser({
        recipientId,
        type: `${result.dispute.entity_type}_dispute_${decisionText}`,
        title: `${entityLabel} dispute ${decisionText}`,
        message: `Your ${entityLabel.toLowerCase()} dispute has been ${decisionText}. Note: ${input.resolutionNote.trim()}`,
        entityType: result.dispute.entity_type,
        entityId: result.dispute.entity_id,
      }),
    ),
  );

  return {
    dispute: result.dispute,
    notificationsCreated: notificationResults.filter(
      (item) => item.status === "fulfilled",
    ).length,
  };
}