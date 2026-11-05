
import { z } from "zod";

const uuidSchema = z.string().uuid();

export const authorizeAgentSchema = z.object({
  agentId: uuidSchema,
});

export const propertyAuthorizationParamsSchema = z.object({
  propertyId: uuidSchema,
});

export const revokeAuthorizationParamsSchema = z.object({
  propertyId: uuidSchema,
  agentId: uuidSchema,
});

export const approvedAgentParamsSchema = z.object({
  agentId: uuidSchema,
});

export const propertyAuthorizationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "revoked"]).optional(),
  location: z.string().trim().max(200).optional(),
  property_type: z.string().trim().max(100).optional(),
});
