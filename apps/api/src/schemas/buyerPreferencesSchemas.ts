import { z } from "zod";
import {
  PAYMENT_PREFERENCES,
  PROPERTY_FEATURES,

} from "@repo/shared-types/propertyConstants";

const categoryIdsSchema = z
  .array(z.string().uuid())
  .max(50)
  .refine((items) => new Set(items).size === items.length, {
    message: "Duplicate categories are not allowed",
  });

const locationIdsSchema = z
  .array(z.string().uuid())
  .max(50)
  .refine((items) => new Set(items).size === items.length, {
    message: "Duplicate locations are not allowed",
  });
const featuresSchema = z
  .array(z.enum(PROPERTY_FEATURES))
  .max(PROPERTY_FEATURES.length)
  .refine((items) => new Set(items).size === items.length, {
    message: "Duplicate features are not allowed",
  });

const preferencesFields = {
  budget_min: z.number().finite().nonnegative().nullable().optional(),
  budget_max: z.number().finite().nonnegative().nullable().optional(),
  category_ids: categoryIdsSchema.nullable().optional(),
  location_ids: locationIdsSchema.nullable().optional(),
  features: featuresSchema.nullable().optional(),
  min_size_sqm: z.number().finite().positive().nullable().optional(),
  min_bedrooms: z.number().int().positive().nullable().optional(),
  payment_preference: z.enum(PAYMENT_PREFERENCES).nullable().optional(),
};

export const updateBuyerPreferencesSchema = z
  .object(preferencesFields)
  .strict()
  .refine(
    (data) =>
      data.budget_min == null ||
      data.budget_max == null ||
      data.budget_min <= data.budget_max,
    {
      message: "Minimum budget must not exceed maximum budget",
      path: ["budget_max"],
    },
  );

export type UpdateBuyerPreferencesInput = z.infer<
  typeof updateBuyerPreferencesSchema
>;
