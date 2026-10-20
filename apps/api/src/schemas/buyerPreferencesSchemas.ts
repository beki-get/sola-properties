import { z } from "zod";
import {
  PAYMENT_PREFERENCES,
  PROPERTY_FEATURES,
  PROPERTY_TYPES,
} from "@repo/shared-types/propertyConstants";

const propertyTypesSchema = z
  .array(z.enum(PROPERTY_TYPES))
  .max(PROPERTY_TYPES.length)
  .refine((items) => new Set(items).size === items.length, {
    message: "Duplicate property types are not allowed",
  });

const locationsSchema = z
  .array(
    z.string()
      .trim()
      .min(1)
      .max(100)
      .transform((location) => location.toLowerCase()),
  )
  .max(10)
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
  property_types: propertyTypesSchema.nullable().optional(),
  locations: locationsSchema.nullable().optional(),
  features: featuresSchema.nullable().optional(),
  min_size_sqm: z.number().finite().positive().nullable().optional(),
  min_bedrooms: z.number().int().positive().nullable().optional(),
  payment_preference: z.enum(PAYMENT_PREFERENCES).nullable().optional(),
};

export const updateBuyerPreferencesSchema = z
  .object(preferencesFields)
  .strict();

export type UpdateBuyerPreferencesInput = z.infer<
  typeof updateBuyerPreferencesSchema
>;