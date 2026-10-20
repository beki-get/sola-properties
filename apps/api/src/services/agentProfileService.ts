
import {
  findAgentProfileByUserId,
  upsertAgentProfile,
} from "../queries/agentProfileQueries";
import type { UpdateAgentProfileInput } from "../schemas/agentProfileSchemas";

export async function getAgentProfile(userId: string) {
  return findAgentProfileByUserId(userId);
}

export async function updateAgentProfile(
  userId: string,
  input: UpdateAgentProfileInput,
) {
  return upsertAgentProfile(userId, input);
}
