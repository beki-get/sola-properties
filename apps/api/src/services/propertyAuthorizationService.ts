import {
  authorizeAgent as queryAuthorizeAgent,
  getApprovedAgent,
  listAgentAuthorizedProperties,
  listApprovedAgents,
  listAuthorizedAgents,
  revokeAgentAuthorization as queryRevokeAgentAuthorization,
  type ListOptions,
} from "../queries/propertyAuthorizationQueries";

import { notifyUser } from "./notificationService";
import { logger } from "../utils/logger";

export function parseListOptions(query: Record<string, unknown>): ListOptions {
  const rawPage = query.page === undefined ? 1 : Number(query.page);
  const rawLimit = query.limit === undefined ? 20 : Number(query.limit);

  if (!Number.isInteger(rawPage) || rawPage < 1) {
    throw new Error("INVALID_PAGE");
  }

  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    throw new Error("INVALID_LIMIT");
  }

  const rawStatus = typeof query.status === "string" ? query.status : undefined;

  if (
    rawStatus !== undefined &&
    rawStatus !== "active" &&
    rawStatus !== "revoked"
  ) {
    throw new Error("INVALID_STATUS_FILTER");
  }

  const status: ListOptions["status"] = rawStatus;

  const search =
    typeof query.search === "string" ? query.search.trim() : undefined;

  const locationId =
    typeof query.location_id === "string" ? query.location_id : undefined;

  const categoryId =
    typeof query.category_id === "string" ? query.category_id : undefined;

  return {
    page: rawPage,
    limit: rawLimit,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(locationId ? { locationId } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
}

export async function authorizeAgent(
  propertyId: string,
  developerId: string,
  agentId: string,
) {
  const authorization = await queryAuthorizeAgent(
    propertyId,
    developerId,
    agentId,
  );

  try {
    await notifyUser({
      recipientId: agentId,
      type: "property_agent_authorized",
      title: "Property authorization received",
      message: "A developer has authorized you to manage a property.",
      entityType: "property",
      entityId: propertyId,
    });
  } catch (error) {
    logger.error(
      { error, propertyId, agentId },
      "Failed to notify agent about property authorization",
    );
  }

  return authorization;
}

export async function revokeAgentAuthorization(
  propertyId: string,
  developerId: string,
  agentId: string,
) {
  const authorization = await queryRevokeAgentAuthorization(
    propertyId,
    developerId,
    agentId,
  );

  try {
    await notifyUser({
      recipientId: agentId,
      type: "property_agent_authorization_revoked",
      title: "Property authorization revoked",
      message: "A developer has revoked your authorization for a property.",
      entityType: "property",
      entityId: propertyId,
    });
  } catch (error) {
    logger.error(
      { error, propertyId, agentId },
      "Failed to notify agent about revoked property authorization",
    );
  }

  return authorization;
}

export {
  getApprovedAgent,
  listAgentAuthorizedProperties,
  listApprovedAgents,
  listAuthorizedAgents,
};
