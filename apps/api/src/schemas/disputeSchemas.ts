
import { z } from "zod";

export const disputeSubmissionSchema = z.object({
  reason: z.string().trim().min(1).max(4000),
}).strict();

export const disputeDecisionSchema = z.object({
  decision: z.enum(["resolved", "rejected"]),
  resolution_note: z.string().trim().min(1).max(4000),
}).strict();

export const disputeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["open", "resolved", "rejected"]).optional(),
}).strict();
