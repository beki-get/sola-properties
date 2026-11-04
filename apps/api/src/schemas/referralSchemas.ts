
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


export const reassignReferralSchema = z.object({
  newAssigneeId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const adminReferralFilterSchema = z.object({
  status: z.enum([
    "assigned",
    "accepted",
    "rejected",
    "in_progress",
    "agreement",
    "closed_won",
    "closed_lost",
  ]).optional(),
});

export const createFollowUpSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

export const referralIdSchema = z.string().uuid();