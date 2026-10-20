import type { QueryResultRow } from "pg";
import { pool } from "../config/database";
import type { UpdateAgentProfileInput } from "../schemas/agentProfileSchemas";

export interface AgentProfile extends QueryResultRow {
  user_id: string;
  phone_number: string | null;
  agency_name: string | null;
  bio: string | null;
  years_of_experience: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function findAgentProfileByUserId(
  userId: string,
): Promise<AgentProfile | null> {
  const result = await pool.query<AgentProfile>(
    `SELECT
       user_id,
       phone_number,
       agency_name,
       bio,
       years_of_experience,
       created_at,
       updated_at
     FROM agent_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function upsertAgentProfile(
  userId: string,
  input: UpdateAgentProfileInput,
): Promise<AgentProfile> {
  const hasPhone = "phone_number" in input;
  const hasAgency = "agency_name" in input;
  const hasBio = "bio" in input;
  const hasExperience = "years_of_experience" in input;

  const result = await pool.query<AgentProfile>(
    `INSERT INTO agent_profiles (
       user_id,
       phone_number,
       agency_name,
       bio,
       years_of_experience
     )
     VALUES ($1, $3, $5, $7, $9)
     ON CONFLICT (user_id)
     DO UPDATE SET
       phone_number = CASE
         WHEN $2::boolean THEN $3::varchar
         ELSE agent_profiles.phone_number
       END,
       agency_name = CASE
         WHEN $4::boolean THEN $5::varchar
         ELSE agent_profiles.agency_name
       END,
       bio = CASE
         WHEN $6::boolean THEN $7::text
         ELSE agent_profiles.bio
       END,
       years_of_experience = CASE
         WHEN $8::boolean THEN $9::integer
         ELSE agent_profiles.years_of_experience
       END,
       updated_at = NOW()
     RETURNING
       user_id,
       phone_number,
       agency_name,
       bio,
       years_of_experience,
       created_at,
       updated_at`,
    [
      userId,
      hasPhone,
      input.phone_number ?? null,
      hasAgency,
      input.agency_name ?? null,
      hasBio,
      input.bio ?? null,
      hasExperience,
      input.years_of_experience ?? null,
    ],
  );

  return result.rows[0]!;
}