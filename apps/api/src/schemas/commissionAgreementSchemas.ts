import { z } from "zod";
import { COMMISSION_STATUSES } from "../constants/commissionConstants";
import { paginationSchema } from "../utils/pagination";

const dateSchema = z.iso.date();

export const createCommissionAgreementSchema = z
  .object({
    sellerId: z.string().uuid().optional(),
    commissionRatePct: z.coerce.number().gt(0).lte(100),
    platformSharePct: z.coerce.number().min(0).max(100),
  })
  .strict();

export const getCommissionsSchema = paginationSchema
  .extend({
    status: z.enum(COMMISSION_STATUSES).optional(),
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
    sellerId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo,
    {
      message: "dateFrom must not be later than dateTo",
      path: ["dateTo"],
    },
  );

export const commissionIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const recordCommissionPaymentSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Amount must have at most 2 decimal places")
      .refine(
        (value) => /[1-9]/.test(value),
        "Amount must be greater than zero",
      ),
    paidOn: dateSchema,
    reference: z.string().trim().min(1).optional(),
  })
  .strict();

export type GetCommissionsInput = z.infer<typeof getCommissionsSchema>;
export type RecordCommissionPaymentInput = z.infer<
  typeof recordCommissionPaymentSchema
>;

export const createCommissionAdjustmentSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .regex(
        /^-?\d+(\.\d{1,2})?$/,
        "Amount must be a valid decimal with at most 2 decimal places",
      )
      .refine((value) => value !== "-0" && Number(value) !== 0, {
        message: "Adjustment amount cannot be zero",
      }),
    reason: z.string().trim().min(1).max(4000),
  })
  .strict();
