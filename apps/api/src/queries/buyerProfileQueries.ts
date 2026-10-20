import type { QueryResultRow } from "pg";
import { pool } from "../config/database";

export interface BuyerProfileRow extends QueryResultRow {
  user_id: string;
  phone_number: string | null;
  preferred_contact_method: "email" | "phone" | "whatsapp" | null;
  created_at: Date;
  updated_at: Date;
}

interface BuyerProfileUpdateFields {
  phoneNumber?: string | null;
  preferredContactMethod?: "email" | "phone" | "whatsapp" | null;
}

export async function findBuyerProfileByUserId(
  userId: string,
): Promise<BuyerProfileRow | null> {
  const result = await pool.query<BuyerProfileRow>(
    `SELECT
       user_id,
       phone_number,
       preferred_contact_method,
       created_at,
       updated_at
     FROM buyer_profiles
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function upsertBuyerProfile(
  userId: string,
  fields: BuyerProfileUpdateFields,
): Promise<BuyerProfileRow> {
  const hasPhoneNumber = fields.phoneNumber !== undefined;
  const hasContactMethod =
    fields.preferredContactMethod !== undefined;

  const result = await pool.query<BuyerProfileRow>(
    `INSERT INTO buyer_profiles (
       user_id,
       phone_number,
       preferred_contact_method
     )
     VALUES ($1, $3, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET
       phone_number = CASE
         WHEN $2::boolean
           THEN $3::varchar
         ELSE buyer_profiles.phone_number
       END,
       preferred_contact_method = CASE
         WHEN $4::boolean
           THEN $5::varchar
         ELSE buyer_profiles.preferred_contact_method
       END,
       updated_at = NOW()
     RETURNING
       user_id,
       phone_number,
       preferred_contact_method,
       created_at,
       updated_at`,
    [
      userId,
      hasPhoneNumber,
      fields.phoneNumber ?? null,
      hasContactMethod,
      fields.preferredContactMethod ?? null,
    ],
  );

  const profile = result.rows[0];

  if (!profile) {
    throw new Error("Buyer profile upsert returned no row");
  }

  return profile;
}