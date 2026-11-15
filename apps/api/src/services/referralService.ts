import {
  createReferralWithHistory,
  getAssignedReferrals,
  decideReferral,
  changeReferralStatus,
  reassignReferral,
  ReassignReferralInput,
  getReferralDetails,
  getAllReferrals,
  getReferralHistory,
  getBuyerReferrals,
  createReferralFollowUp,
  getReferralFollowUps,
  createReferralMessage,
  getReferralMessages,
  createReferralIssue,
  getMyReferralIssues,
  getAdminReferralIssues,
  getAdminReferralIssueById,
  updateReferralIssue,
  getAllReferralsForExport,
} from "../queries/referralQueries";

import { notifyUser } from "./notificationService";
import { logger } from "../utils/logger";
import { generateCsv } from "../utils/csv";
import type { AdminReferralFilter } from "../schemas/referralSchemas";

interface CreateReferralInput {
  buyerId: string;
  propertyId: string;
  message?: string | null;
}

async function sendReferralNotification(
  input: Parameters<typeof notifyUser>[0],
) {
  try {
    await notifyUser(input);
  } catch (error) {
    logger.error({ err: error }, "Failed to create referral notification");
  }
}

export async function createReferral(input: CreateReferralInput) {
  const referral = await createReferralWithHistory(input);

  await sendReferralNotification({
    recipientId: referral.assigned_to,
    type: "referral_created",
    title: "New buyer inquiry",
    message: "You have received a new inquiry about a property.",
    entityType: "referral",
    entityId: referral.id,
  });

  return referral;
}

//agent or developer 
export async function getMyReferrals(assigneeId: string) {
  return getAssignedReferrals(assigneeId);
}

//export for agent or developer
export async function exportMyReferrals(assigneeId: string) {
  const referrals = await getAssignedReferrals(assigneeId);

  const headers = [
    "Referral ID",
    "Reference Code",
    "Buyer ID",
    "Buyer Name",
    "Property ID",
    "Property Title",
    "Message",
    "Status",
    "Status Reason",
    "Assigned At",
    "Accepted At",
    "Created At",
    "Updated At",
  ];

  const rows = referrals.map((referral) => [
    referral.id,
    referral.reference_code,
    referral.buyer_id,
    referral.buyer_name,
    referral.property_id,
    referral.property_title,
    referral.message,
    referral.status,
    referral.status_reason,
    referral.assigned_at.toISOString(),
    referral.accepted_at?.toISOString() ?? "",
    referral.created_at.toISOString(),
    referral.updated_at.toISOString(),
  ]);

  return generateCsv(headers, rows);
}

export async function respondToReferral(input: {
  referralId: string;
  actorId: string;
  decision: "accepted" | "rejected";
  reason?: string;
}) {
  const referral = await decideReferral(input);

  await sendReferralNotification({
    recipientId: referral.buyer_id,
    type:
      input.decision === "accepted" ? "referral_accepted" : "referral_rejected",
    title:
      input.decision === "accepted" ? "Inquiry accepted" : "Inquiry rejected",
    message:
      input.decision === "accepted"
        ? "The seller has accepted your property inquiry."
        : `The seller has rejected your property inquiry.${referral.status_reason ? ` Reason: ${referral.status_reason}` : ""}`,
    entityType: "referral",
    entityId: referral.id,
  });

  return referral;
}

export async function updateReferralStatus(input: {
  referralId: string;
  actorId: string;
  status: "in_progress" | "agreement" | "closed_won" | "closed_lost";
  reason?: string;
}) {
  const referral = await changeReferralStatus(input);

  await sendReferralNotification({
    recipientId: referral.buyer_id,
    type: "referral_status_changed",
    title: "Referral status updated",
    message: `Your property inquiry status has changed to ${input.status.replace(/_/g, " ")}.`,
    entityType: "referral",
    entityId: referral.id,
  });

  return referral;
}

export async function reassignReferralService(input: ReassignReferralInput) {
  const referral = await reassignReferral(input);

  await sendReferralNotification({
    recipientId: referral.assigned_to,
    type: "referral_reassigned",
    title: "New referral assigned",
    message: "An administrator has assigned a referral to you.",
    entityType: "referral",
    entityId: referral.id,
  });

  return referral;
}

export async function getAllReferralsService(input: AdminReferralFilter) {
  return getAllReferrals(input);
}

export async function exportAllReferralsService(input: AdminReferralFilter) {
  const referrals = await getAllReferralsForExport(input);

  const headers = [
    "Referral ID",
    "Reference Code",
    "Buyer ID",
    "Buyer Name",
    "Property ID",
    "Property Title",
    "Assigned To",
    "Assignee Name",
    "Message",
    "Status",
    "Status Reason",
    "Assigned At",
    "Accepted At",
    "Created At",
    "Updated At",
  ];

  const rows = referrals.map((referral) => [
    referral.id,
    referral.reference_code,
    referral.buyer_id,
    referral.buyer_name,
    referral.property_id,
    referral.property_title,
    referral.assigned_to,
    referral.assignee_name,
    referral.message,
    referral.status,
    referral.status_reason,
    referral.assigned_at?.toISOString() ?? "",
    referral.accepted_at?.toISOString() ?? "",
    referral.created_at.toISOString(),
    referral.updated_at.toISOString(),
  ]);

  return generateCsv(headers, rows);
}

export async function getReferralDetailsService(referralId: string) {
  return getReferralDetails(referralId);
}

export async function getReferralHistoryService(referralId: string) {
  return getReferralHistory(referralId);
}

export async function getBuyerReferralsService(buyerId: string) {
  return getBuyerReferrals(buyerId);
}

export async function createReferralFollowUpService(input: {
  referralId: string;
  senderId: string;
  body: string;
  dueAt?: string;
}) {
  return createReferralFollowUp(input);
}

export async function getReferralFollowUpsService(input: {
  referralId: string;
  userId: string;
  isAdmin: boolean;
  page: number;
  limit: number;
}) {
  return getReferralFollowUps(input);
}

export async function createReferralMessageService(input: {
  referralId: string;
  senderId: string;
  senderRole: "buyer" | "agent" | "developer";
  body: string;
}) {
  const { recipient_id, ...message } = await createReferralMessage(input);

  if (recipient_id) {
    await sendReferralNotification({
      recipientId: recipient_id,
      type: "referral_message_received",
      title: "New referral message",
      message: "You have received a new message about a referral.",
      entityType: "referral",
      entityId: input.referralId,
    });
  }

  return message;
}
export async function getReferralMessagesService(input: {
  referralId: string;
  userId: string;
  isAdmin: boolean;
  page: number;
  limit: number;
}) {
  return getReferralMessages(input);
}

//issue related services
export async function createReferralIssueService(input: {
  referralId: string;
  reportedBy: string;
  reporterRole: "buyer" | "agent" | "developer";
  category: string;
  subject: string;
  description: string;
}) {
  return createReferralIssue(input);
}

export async function getMyReferralIssuesService(input: {
  userId: string;
  page: number;
  limit: number;
}) {
  return getMyReferralIssues(input);
}

export async function getAdminReferralIssuesService(input: {
  page: number;
  limit: number;
  status?: string;
}) {
  return getAdminReferralIssues(input);
}

export async function getAdminReferralIssueByIdService(issueId: string) {
  return getAdminReferralIssueById(issueId);
}

export async function updateReferralIssueService(input: {
  issueId: string;
  adminId: string;
  status?: string;
  adminNotes?: string | null;
  resolution?: string | null;
}) {
  return updateReferralIssue(input);
}
