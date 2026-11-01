import {
  createReferralWithHistory,
  getAssignedReferrals,
  decideReferral,
  changeReferralStatus,
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