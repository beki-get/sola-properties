import { pool } from "../config/database";

export interface BuyerPreferencesRow {
  user_id: string;
  budget_min: string | null;
  budget_max: string | null;
  category_ids: string[];
  location_ids: string[];
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
    `SELECT
       p.*,
       COALESCE(
         (SELECT ARRAY_AGG(pc.category_id)
          FROM preference_categories pc
          WHERE pc.user_id = p.user_id),
         ARRAY[]::uuid[]
       ) AS category_ids,
       COALESCE(
         (SELECT ARRAY_AGG(pl.location_id)
          FROM preference_locations pl
          WHERE pl.user_id = p.user_id),
         ARRAY[]::uuid[]
       ) AS location_ids
     FROM preferences p
     WHERE p.user_id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export interface SaveBuyerPreferencesParams {
  userId: string;
  budgetMin: number | null;
  budgetMax: number | null;
  categoryIds: string[];
  locationIds: string[];
  features: string[];
  minSizeSqm: number | null;
  minBedrooms: number | null;
  paymentPreference: string | null;
}

export async function saveBuyerPreferences(
  input: SaveBuyerPreferencesParams,
): Promise<BuyerPreferencesRow> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate all selected categories are active.
    if (input.categoryIds.length > 0) {
      const categoriesResult = await client.query(
        `SELECT id
         FROM property_categories
         WHERE id = ANY($1::uuid[])
           AND is_active = TRUE`,
        [input.categoryIds],
      );

      if (categoriesResult.rowCount !== input.categoryIds.length) {
        throw new Error(
          "One or more selected categories are invalid or inactive",
        );
      }
    }

    // Validate all selected locations are active.
    if (input.locationIds.length > 0) {
      const locationsResult = await client.query(
        `SELECT id
         FROM property_locations
         WHERE id = ANY($1::uuid[])
           AND is_active = TRUE`,
        [input.locationIds],
      );

      if (locationsResult.rowCount !== input.locationIds.length) {
        throw new Error(
          "One or more selected locations are invalid or inactive",
        );
      }
    }

    // Save ordinary preference fields.
    await client.query(
      `INSERT INTO preferences (
         user_id,
         budget_min,
         budget_max,
         features,
         min_size_sqm,
         min_bedrooms,
         payment_preference
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id)
       DO UPDATE SET
         budget_min = EXCLUDED.budget_min,
         budget_max = EXCLUDED.budget_max,
         features = EXCLUDED.features,
         min_size_sqm = EXCLUDED.min_size_sqm,
         min_bedrooms = EXCLUDED.min_bedrooms,
         payment_preference = EXCLUDED.payment_preference,
         updated_at = NOW()`,
      [
        input.userId,
        input.budgetMin,
        input.budgetMax,
        input.features,
        input.minSizeSqm,
        input.minBedrooms,
        input.paymentPreference,
      ],
    );

    // Replace category preferences.
    await client.query(`DELETE FROM preference_categories WHERE user_id = $1`, [
      input.userId,
    ]);

    if (input.categoryIds.length > 0) {
      await client.query(
        `INSERT INTO preference_categories (user_id, category_id)
         SELECT $1, unnest($2::uuid[])`,
        [input.userId, input.categoryIds],
      );
    }

    // Replace location preferences.
    await client.query(`DELETE FROM preference_locations WHERE user_id = $1`, [
      input.userId,
    ]);

    if (input.locationIds.length > 0) {
      await client.query(
        `INSERT INTO preference_locations (user_id, location_id)
         SELECT $1, unnest($2::uuid[])`,
        [input.userId, input.locationIds],
      );
    }

    // Return the complete updated preferences.
    const result = await client.query<BuyerPreferencesRow>(
      `SELECT
         p.*,
         COALESCE(
           (SELECT ARRAY_AGG(pc.category_id)
            FROM preference_categories pc
            WHERE pc.user_id = p.user_id),
           ARRAY[]::uuid[]
         ) AS category_ids,
         COALESCE(
           (SELECT ARRAY_AGG(pl.location_id)
            FROM preference_locations pl
            WHERE pl.user_id = p.user_id),
           ARRAY[]::uuid[]
         ) AS location_ids
       FROM preferences p
       WHERE p.user_id = $1`,
      [input.userId],
    );

    await client.query("COMMIT");

    return result.rows[0]!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
