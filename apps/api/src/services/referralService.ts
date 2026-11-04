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