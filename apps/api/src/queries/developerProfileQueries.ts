import type { QueryResultRow } from "pg";
import { pool } from "../config/database";

export interface DeveloperProfile extends QueryResultRow {
  user_id: string;
  company_name: string;
  company_description: string | null;
  contact_phone: string;
  business_address: string;
  website_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeveloperProfileWriteInput {
  company_name: string;
  company_description: string | null;
  contact_phone: string;
  business_address: string;
  website_url: string | null;
}

export async function findDeveloperProfileByUserId(
  userId: string,
): Promise<DeveloperProfile | null> {
  const result = await pool.query<DeveloperProfile>(
    `SELECT
       user_id,
       company_name,
       company_description,
       contact_phone,
       business_address,
       website_url,
       created_at,
       updated_at
     FROM developer_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function upsertDeveloperProfile(
  userId: string,
  input: DeveloperProfileWriteInput,
): Promise<DeveloperProfile> {
  const result = await pool.query<DeveloperProfile>(
    `INSERT INTO developer_profiles (
       user_id,
       company_name,
       company_description,
       contact_phone,
       business_address,
       website_url
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id)
     DO UPDATE SET
       company_name = EXCLUDED.company_name,
       company_description = EXCLUDED.company_description,
       contact_phone = EXCLUDED.contact_phone,
       business_address = EXCLUDED.business_address,
       website_url = EXCLUDED.website_url,
       updated_at = NOW()
     RETURNING
       user_id,
       company_name,
       company_description,
       contact_phone,
       business_address,
       website_url,
       created_at,
       updated_at`,
    [
      userId,
      input.company_name,
      input.company_description,
      input.contact_phone,
      input.business_address,
      input.website_url,
    ],
  );

  return result.rows[0]!;
}