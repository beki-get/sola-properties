
import { z } from "zod";

export const createReferralSchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000).optional(),
});

export const referralDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("accepted"),
  }),
  z.object({
    decision: z.literal("rejected"),
    reason: z.string().trim().min(1).max(1000),
  }),
]);

export const referralStatusSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("in_progress"),
  }),
  z.object({
    status: z.literal("agreement"),
  }),
  z.object({
    status: z.literal("closed_won"),
  }),
  z.object({
    status: z.literal("closed_lost"),
    reason: z.string().trim().min(1).max(1000),
  }),
]);
