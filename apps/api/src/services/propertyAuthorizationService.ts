import {
  authorizeAgent,
  getApprovedAgent,
  listAgentAuthorizedProperties,
  listApprovedAgents,
  listAuthorizedAgents,
  revokeAgentAuthorization,
  type ListOptions,
} from "../queries/propertyAuthorizationQueries";

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

  const location =
    typeof query.location === "string" ? query.location.trim() : undefined;

  const propertyType =
    typeof query.property_type === "string"
      ? query.property_type.trim()
      : undefined;

  return {
    page: rawPage,
    limit: rawLimit,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(location ? { location } : {}),
    ...(propertyType ? { propertyType } : {}),
  };
}

export {
  authorizeAgent,
  getApprovedAgent,
  listAgentAuthorizedProperties,
  listApprovedAgents,
  listAuthorizedAgents,
  revokeAgentAuthorization,
};
