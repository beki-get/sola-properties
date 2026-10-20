import {
  findBuyerPreferences,
  saveBuyerPreferences,
} from "../queries/buyerPreferencesQueries";
import type { UpdateBuyerPreferencesInput } from "../schemas/buyerPreferencesSchemas";

type PreferencesInput = UpdateBuyerPreferencesInput;

function validateBudgetRange(
  min: number | null,
  max: number | null,
): void {
  if (min !== null && max !== null && min > max) {
    const error = new Error(
      "Minimum budget cannot exceed maximum budget",
    ) as Error & { statusCode: number; code: string };

    error.statusCode = 400;
    error.code = "INVALID_BUDGET_RANGE";
    throw error;
  }
}

export async function getBuyerPreferences(userId: string) {
  return findBuyerPreferences(userId);
}

export async function replaceBuyerPreferences(
  userId: string,
  input: PreferencesInput,
) {
  const budgetMin = input.budget_min ?? null;
  const budgetMax = input.budget_max ?? null;

  validateBudgetRange(budgetMin, budgetMax);

  return saveBuyerPreferences({
    userId,
    budgetMin,
    budgetMax,
    propertyTypes: input.property_types ?? [],
    locations: input.locations ?? [],
    features: input.features ?? [],
    minSizeSqm: input.min_size_sqm ?? null,
    minBedrooms: input.min_bedrooms ?? null,
    paymentPreference: input.payment_preference ?? null,
  });
}

export async function patchBuyerPreferences(
  userId: string,
  input: PreferencesInput,
) {
  const existing = await findBuyerPreferences(userId);

  const budgetMin =
    input.budget_min !== undefined
      ? input.budget_min
      : existing?.budget_min === null || !existing
        ? null
        : Number(existing.budget_min);

  const budgetMax =
    input.budget_max !== undefined
      ? input.budget_max
      : existing?.budget_max === null || !existing
        ? null
        : Number(existing.budget_max);

  validateBudgetRange(budgetMin, budgetMax);

  return saveBuyerPreferences({
    userId,
    budgetMin,
    budgetMax,
    propertyTypes:
      input.property_types === undefined
        ? existing?.property_types ?? []
        : input.property_types ?? [],
    locations:
      input.locations === undefined
        ? existing?.locations ?? []
        : input.locations ?? [],
    features:
      input.features === undefined
        ? existing?.features ?? []
        : input.features ?? [],
    minSizeSqm:
      input.min_size_sqm === undefined
        ? existing?.min_size_sqm == null
          ? null
          : Number(existing.min_size_sqm)
        : input.min_size_sqm,
    minBedrooms:
      input.min_bedrooms === undefined
        ? existing?.min_bedrooms ?? null
        : input.min_bedrooms,
    paymentPreference:
      input.payment_preference === undefined
        ? existing?.payment_preference ?? null
        : input.payment_preference,
  });
}