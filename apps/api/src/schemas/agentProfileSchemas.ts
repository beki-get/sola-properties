
import { z } from "zod";

const phoneNumberSchema = z
  .string()
  .trim()
  .min(7, "Phone number must contain at least 7 characters")
  .max(20, "Phone number must not exceed 20 characters")
  .regex(/^\+?[0-9().\-\s]+$/, "Enter a valid phone number");

export const updateAgentProfileSchema = z
  .object({
    phone_number: phoneNumberSchema.nullable().optional(),

    agency_name: z
      .string()
      .trim()
      .max(200, "Agency name must not exceed 200 characters")
      .nullable()
      .optional(),

    bio: z
      .string()
      .trim()
      .max(5000, "Bio must not exceed 5000 characters")
      .nullable()
      .optional(),

    years_of_experience: z
      .number()
      .int("Years of experience must be an integer")
      .min(0, "Years of experience cannot be negative")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.phone_number !== undefined ||
      data.agency_name !== undefined ||
      data.bio !== undefined ||
      data.years_of_experience !== undefined,
    { message: "Provide at least one field to update" },
  );

export type UpdateAgentProfileInput = z.infer<
  typeof updateAgentProfileSchema
>;
