import { z } from "zod";

const phoneNumberSchema = z
  .string()
  .trim()
  .min(7, "Phone number must contain at least 7 characters")
  .max(20, "Phone number must not exceed 20 characters")
  .regex(
    /^\+?[0-9().\-\s]+$/,
    "Enter a valid phone number",
  );

export const updateBuyerProfileSchema = z
  .object({
    phoneNumber: phoneNumberSchema.nullable().optional(),

    preferredContactMethod: z
      .enum(["email", "phone", "whatsapp"])
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.phoneNumber !== undefined ||
      data.preferredContactMethod !== undefined,
    {
      message: "Provide at least one field to update",
    },
  );

export type UpdateBuyerProfileInput = z.infer<
  typeof updateBuyerProfileSchema
>;