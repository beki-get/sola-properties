import { z } from "zod";
import {
  PROPERTY_TYPES,
  PAYMENT_PREFERENCES,
  PROPERTY_FEATURES,
} from "@repo/shared-types/propertyConstants";

export const createPropertySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000).nullable().optional(),
    property_type: z.enum(PROPERTY_TYPES),
    location: z.string().trim().min(1).max(300),
    size_sqm: z.number().positive().nullable().optional(),
    bedrooms: z.number().int().nonnegative().nullable().optional(),
    bathrooms: z.number().int().nonnegative().nullable().optional(),
    features: z.array(z.enum(PROPERTY_FEATURES)).max(20).default([]),
    price: z.number().positive(),
    payment_plan: z.enum(PAYMENT_PREFERENCES),
    project_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export const updatePropertySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    property_type: z.enum(PROPERTY_TYPES).optional(),
    location: z.string().trim().min(1).max(300).optional(),
    size_sqm: z.number().positive().nullable().optional(),
    bedrooms: z.number().int().nonnegative().nullable().optional(),
    bathrooms: z.number().int().nonnegative().nullable().optional(),
    features: z.array(z.enum(PROPERTY_FEATURES)).max(20).optional(),
    price: z.number().positive().optional(),
    payment_plan: z.enum(PAYMENT_PREFERENCES).optional(),
    project_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const updatePropertyStatusSchema = z
  .object({
    status: z.enum(["inactive", "sold"]),
  })
  .strict();

export const propertyListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum([
        "draft",
        "pending_approval",
        "active",
        "inactive",
        "sold",
        "rejected",
      ])
      .optional(),
  })
  .strict();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;

const csvValues = (value: unknown) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

export const publicPropertyListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(200).optional(),
    location: z.string().trim().max(300).optional(),
    property_types: z.preprocess(
      csvValues,
      z.array(z.enum(PROPERTY_TYPES)).max(10).optional(),
    ),
    features: z.preprocess(
      csvValues,
      z.array(z.enum(PROPERTY_FEATURES)).max(20).optional(),
    ),
    price_min: z.coerce.number().nonnegative().optional(),
    price_max: z.coerce.number().nonnegative().optional(),
    min_size_sqm: z.coerce.number().positive().optional(),
    min_bedrooms: z.coerce.number().int().nonnegative().optional(),
    payment_plan: z.enum(PAYMENT_PREFERENCES).optional(),
    sort: z
      .enum(["newest", "price_asc", "price_desc", "location", "relevance"])
      .default("newest"),
  })
  .strict()
  .refine(
    (data) =>
      data.price_min === undefined ||
      data.price_max === undefined ||
      data.price_min <= data.price_max,
    { message: "Minimum price cannot exceed maximum price" },
  );

export const comparePropertiesQuerySchema = z
  .object({
    ids: z
      .string()
      .transform((value) => value.split(",").map((id) => id.trim())),
  })
  .strict()
  .refine(
    (data) =>
      data.ids.length >= 2 &&
      data.ids.length <= 4 &&
      data.ids.every((id) => z.string().uuid().safeParse(id).success) &&
      new Set(data.ids).size === data.ids.length,
    { message: "Provide 2–4 unique, valid property IDs" },
  );

export type PublicPropertyListQuery = z.infer<
  typeof publicPropertyListQuerySchema
>;


//admin schemas 
export const adminPendingPropertyListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const adminPropertyDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    rejection_reason: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.decision !== "reject" ||
      data.rejection_reason !== undefined,
    {
      message: "A rejection reason is required",
      path: ["rejection_reason"],
    },
  );

export type AdminPendingPropertyListQuery = z.infer<
  typeof adminPendingPropertyListQuerySchema
>;

export type AdminPropertyDecisionInput = z.infer<
  typeof adminPropertyDecisionSchema
>;