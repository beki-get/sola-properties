import { z } from "zod";

export const referralIssueCategories = [
  "communication",
  "property_information",
  "seller_behavior",
  "buyer_behavior",
  "payment",
  "visit_or_scheduling",
  "fraud_or_suspicious_activity",
  "other",
] as const;

export const referralIssueStatuses = [
  "open",
  "under_review",
  "resolved",
  "dismissed",
] as const;

// Buyer or assigned seller submits a report.
export const createReferralIssueSchema = z.object({
  referralId: z.string().uuid(),

  category: z.enum(referralIssueCategories),

  subject: z.string().trim().min(1).max(200),

  description: z.string().trim().min(1).max(5000),
});

// Admin updates an existing report.
export const updateReferralIssueSchema = z.object({
  status: z.enum(referralIssueStatuses).optional(),

  adminNotes: z.string().trim().max(5000).nullable().optional(),

  resolution: z.string().trim().max(5000).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);