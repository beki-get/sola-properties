import { z } from "zod";

const dateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date value. Use a valid ISO date string.",
  });

export const transactionSubmissionSchema = z
  .object({
    referralId: z.string().uuid(),
    sale_amount: z.coerce.number().positive(),
    closing_date: dateStringSchema,
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();

export const transactionUpdateSchema = z
  .object({
    sale_amount: z.coerce.number().positive().optional(),
    closing_date: dateStringSchema.optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const transactionDecisionSchema = z
  .object({
    decision: z.enum(["verified", "rejected"]),
    reason: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (data) => data.decision !== "rejected" || Boolean(data.reason?.trim()),
    {
      message: "A rejection reason is required when rejecting a transaction.",
      path: ["reason"],
    },
  );

export const transactionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["submitted", "verified", "rejected"]).optional(),
  })
  .strict();

export type TransactionSubmissionInput = z.infer<typeof transactionSubmissionSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionDecisionInput = z.infer<typeof transactionDecisionSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
