import type { RequestHandler } from "express";
import { PropertyAuthorizationError } from "../queries/propertyAuthorizationQueries";
import {
  authorizeAgent,
  getApprovedAgent,
  listAgentAuthorizedProperties,
  listApprovedAgents,
  listAuthorizedAgents,
  parseListOptions,
  revokeAgentAuthorization,
} from "../services/propertyAuthorizationService";
import {
  authorizeAgentSchema,
  propertyAuthorizationParamsSchema,
  propertyAuthorizationQuerySchema,
  revokeAuthorizationParamsSchema,
  approvedAgentParamsSchema,
} from "../schemas/propertyAuthorizationSchemas";

function sendError(res: Parameters<RequestHandler>[1], error: unknown) {
  if (error instanceof PropertyAuthorizationError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof Error && error.message.startsWith("INVALID_")) {
    const messages: Record<string, string> = {
      INVALID_PAGE: "page must be a positive integer.",
      INVALID_LIMIT: "limit must be an integer between 1 and 100.",
      INVALID_STATUS_FILTER: "status must be active or revoked.",
      INVALID_QUERY_PARAMETERS: "Invalid query parameters.",
    };

    res.status(400).json({
      message: messages[error.message] ?? "Invalid query parameters.",
      code: error.message,
    });
    return;
  }

  res.status(500).json({
    message: "An unexpected error occurred.",
    code: "INTERNAL_SERVER_ERROR",
  });
}

function validateQuery(query: Record<string, unknown>) {
  const result = propertyAuthorizationQuerySchema.safeParse(query);

  if (!result.success) {
    throw new Error("INVALID_QUERY_PARAMETERS");
  }

  return parseListOptions(result.data);
}

function sendValidationError(
  res: Parameters<RequestHandler>[1],
  code: string,
  message: string,
) {
  res.status(400).json({ message, code });
}

export const authorizeAgentController: RequestHandler = async (req, res) => {
  try {
    const params = propertyAuthorizationParamsSchema.safeParse(req.params);
    if (!params.success) {
      sendValidationError(
        res,
        "INVALID_PROPERTY_ID",
        "A valid propertyId UUID is required.",
      );
      return;
    }

    const body = authorizeAgentSchema.safeParse(req.body);
    if (!body.success) {
      sendValidationError(
        res,
        "INVALID_AGENT_ID",
        "A valid agentId UUID is required.",
      );
      return;
    }

    const result = await authorizeAgent(
      params.data.propertyId,
      req.currentUser!.id,
      body.data.agentId,
    );

    res.status(201).json({
      message: "Agent authorized successfully.",
      authorization: result,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const listAuthorizedAgentsController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const params = propertyAuthorizationParamsSchema.safeParse(req.params);
    if (!params.success) {
      sendValidationError(
        res,
        "INVALID_PROPERTY_ID",
        "A valid propertyId UUID is required.",
      );
      return;
    }

    const result = await listAuthorizedAgents(
      params.data.propertyId,
      req.currentUser!.id,
      validateQuery(req.query as Record<string, unknown>),
    );

    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

export const revokeAgentAuthorizationController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const params = revokeAuthorizationParamsSchema.safeParse(req.params);
    if (!params.success) {
      sendValidationError(
        res,
        "INVALID_ROUTE_PARAMS",
        "Valid propertyId and agentId UUIDs are required.",
      );
      return;
    }

    const result = await revokeAgentAuthorization(
      params.data.propertyId,
      req.currentUser!.id,
      params.data.agentId,
    );

    res.status(200).json({
      message: "Agent authorization revoked.",
      authorization: result,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const listAgentAuthorizedPropertiesController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const result = await listAgentAuthorizedProperties(
      req.currentUser!.id,
      validateQuery(req.query as Record<string, unknown>),
    );

    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

export const listApprovedAgentsController: RequestHandler = async (
  req,
  res,
) => {
  try {
    const result = await listApprovedAgents(
      validateQuery(req.query as Record<string, unknown>),
    );

    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

export const getApprovedAgentController: RequestHandler = async (req, res) => {
  try {
    const params = approvedAgentParamsSchema.safeParse(req.params);
    if (!params.success) {
      sendValidationError(
        res,
        "INVALID_AGENT_ID",
        "A valid agentId UUID is required.",
      );
      return;
    }

    const agent = await getApprovedAgent(params.data.agentId);

    res.status(200).json({ agent });
  } catch (error) {
    sendError(res, error);
  }
};
