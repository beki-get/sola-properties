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
} from "../queries/referralQueries";

interface CreateReferralInput {
  buyerId: string;
  propertyId: string;
  message?: string | null;
}

export async function createReferral(input: CreateReferralInput) {
  return createReferralWithHistory(input);
}

export async function getMyReferrals(agentId: string) {
  return getAssignedReferrals(agentId);
}

export async function respondToReferral(input: {
  referralId: string;
  actorId: string;
  decision: "accepted" | "rejected";
  reason?: string;
}) {
  return decideReferral(input);
}

export async function updateReferralStatus(input: {
  referralId: string;
  actorId: string;
  status: "in_progress" | "agreement" | "closed_won" | "closed_lost";
  reason?: string;
}) {
  return changeReferralStatus(input);
}

export async function reassignReferralService(
  input: ReassignReferralInput,
) {
  return reassignReferral(input);
}

export async function getAllReferralsService(status?: string) {
  return getAllReferrals(status);
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
  return createReferralMessage(input);
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