import { pool } from "../config/database";

export interface BuyerPreferencesRow {
  user_id: string;
  budget_min: string | null;
  budget_max: string | null;
  property_types: string[];
  locations: string[];
  features: string[];
  min_size_sqm: string | null;
  min_bedrooms: number | null;
  payment_preference: string | null;
  updated_at: Date;
}

export async function findBuyerPreferences(
  userId: string,
): Promise<BuyerPreferencesRow | null> {
  const result = await pool.query<BuyerPreferencesRow>(
    `SELECT *
     FROM preferences
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export interface SaveBuyerPreferencesParams {
  userId: string;
  budgetMin: number | null;
  budgetMax: number | null;
  propertyTypes: string[];
  locations: string[];
  features: string[];
  minSizeSqm: number | null;
  minBedrooms: number | null;
  paymentPreference: string | null;
}

export async function saveBuyerPreferences(
  input: SaveBuyerPreferencesParams,
): Promise<BuyerPreferencesRow> {
  const result = await pool.query<BuyerPreferencesRow>(
    `INSERT INTO preferences (
       user_id,
       budget_min,
       budget_max,
       property_types,
       locations,
       features,
       min_size_sqm,
       min_bedrooms,
       payment_preference
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id)
     DO UPDATE SET
       budget_min = EXCLUDED.budget_min,
       budget_max = EXCLUDED.budget_max,
       property_types = EXCLUDED.property_types,
       locations = EXCLUDED.locations,
       features = EXCLUDED.features,
       min_size_sqm = EXCLUDED.min_size_sqm,
       min_bedrooms = EXCLUDED.min_bedrooms,
       payment_preference = EXCLUDED.payment_preference,
       updated_at = NOW()
     RETURNING *`,
    [
      input.userId,
      input.budgetMin,
      input.budgetMax,
      input.propertyTypes,
      input.locations,
      input.features,
      input.minSizeSqm,
      input.minBedrooms,
      input.paymentPreference,
    ],
  );

  return result.rows[0]!;
}