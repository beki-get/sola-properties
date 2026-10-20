import { z } from "zod";

const phoneNumberSchema = z
  .string()
  .trim()
  .min(7, "Phone number must contain at least 7 characters")
  .max(30, "Phone number must not exceed 30 characters")
  .regex(/^\+?[0-9().\-\s]+$/, "Enter a valid phone number");

export const updateDeveloperProfileSchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(1, "Company name is required")
      .max(200, "Company name must not exceed 200 characters")
      .optional(),

    company_description: z
      .string()
      .trim()
      .max(5000, "Company description must not exceed 5000 characters")
      .nullable()
      .optional(),

    contact_phone: phoneNumberSchema.optional(),

    business_address: z
      .string()
      .trim()
      .min(1, "Business address cannot be empty")
      .max(300, "Business address must not exceed 300 characters")
      .optional(),

    website_url: z
      .string()
      .trim()
      .url("Enter a valid website URL")
      .max(2048, "Website URL is too long")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.company_name !== undefined ||
      data.company_description !== undefined ||
      data.contact_phone !== undefined ||
      data.business_address !== undefined ||
      data.website_url !== undefined,
    { message: "Provide at least one field to update" },
  );

export type UpdateDeveloperProfileInput = z.infer<
  typeof updateDeveloperProfileSchema
>;