import { pool } from "../config/database";
import type { Pool, PoolClient } from "pg";
import type {
  AdminUserCreateInput,
  AdminUserListFilters,
  AuditLogFilters,
} from "../schemas/adminSchemas";

export interface AuditLogRecord {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: unknown;
  new_values: unknown;
  created_at: Date;
}

export interface AdminUserListRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface AdminUserDetailRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    buyer?: {
      phoneNumber: string | null;
      preferredContactMethod: "email" | "phone" | "whatsapp" | null;
    };
    agent?: {
      phoneNumber: string | null;
      agencyName: string | null;
      bio: string | null;
      yearsOfExperience: number | null;
    };
    developer?: {
      companyName: string | null;
      companyDescription: string | null;
      contactPhone: string | null;
      businessAddress: string | null;
      websiteUrl: string | null;
    };
  };
}

export type AdminUserRow = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export interface PropertyLookupRecord {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PropertyLookupKind = "category" | "location";

function getPropertyLookupTableName(kind: PropertyLookupKind): string {
  return kind === "category" ? "property_categories" : "property_locations";
}

export async function listPropertyLookupsQuery(
  kind: PropertyLookupKind,
  includeInactive = false,
): Promise<PropertyLookupRecord[]> {
  const tableName = getPropertyLookupTableName(kind);
  const result = await pool.query<PropertyLookupRecord>(
    `SELECT
       id,
       name,
       is_active AS "isActive",
       created_at AS "createdAt",
       updated_at AS "updatedAt"
     FROM ${tableName}
     ${includeInactive ? "" : "WHERE is_active = TRUE"}
     ORDER BY LOWER(name), name`,
  );

  return result.rows;
}

export async function findPropertyLookupById(
  kind: PropertyLookupKind,
  id: string,
  client: Pool | PoolClient = pool,
): Promise<PropertyLookupRecord | null> {
  const tableName = getPropertyLookupTableName(kind);

  const result = await client.query<PropertyLookupRecord>(
    `SELECT
       id,
       name,
       is_active AS "isActive",
       created_at AS "createdAt",
       updated_at AS "updatedAt"
     FROM ${tableName}
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function insertPropertyLookup(
  kind: PropertyLookupKind,
  input: { name: string },
  client: Pool | PoolClient = pool,
): Promise<PropertyLookupRecord> {
  const tableName = getPropertyLookupTableName(kind);

  const result = await client.query<PropertyLookupRecord>(
    `INSERT INTO ${tableName} (name)
     VALUES ($1)
     RETURNING
       id,
       name,
       is_active AS "isActive",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [input.name],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error(`Failed to insert ${kind} lookup`);
  }

  return row;
}

export async function updatePropertyLookupRecord(
  kind: PropertyLookupKind,
  id: string,
  updates: Partial<{ name: string; is_active: boolean }>,
  client: Pool | PoolClient = pool,
): Promise<PropertyLookupRecord> {
  const tableName = getPropertyLookupTableName(kind);
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    values.push(updates.name);
    setClauses.push(`name = $${values.length}`);
  }

  if (updates.is_active !== undefined) {
    values.push(updates.is_active);
    setClauses.push(`is_active = $${values.length}`);
  }

  if (setClauses.length === 0) {
    throw new Error("No property lookup updates provided");
  }

  values.push(id);
  const result = await client.query<PropertyLookupRecord>(
    `UPDATE ${tableName}
     SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING
       id,
       name,
       is_active AS "isActive",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    values,
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error(`Failed to update ${kind} lookup`);
  }

  return row;
}

export async function findAuditLogs(
  filters: AuditLogFilters,
): Promise<{ logs: AuditLogRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  function addFilter(column: string, value: unknown) {
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  }

  if (filters.actor_id) addFilter("actor_id", filters.actor_id);
  if (filters.action) addFilter("action", filters.action);
  if (filters.entity_type) addFilter("entity_type", filters.entity_type);
  if (filters.entity_id) addFilter("entity_id", filters.entity_id);

  if (filters.start_date) {
    values.push(filters.start_date);
    conditions.push(`created_at >= $${values.length}`);
  }

  if (filters.end_date) {
    values.push(filters.end_date);
    conditions.push(`created_at <= $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM audit_logs
     ${whereClause}`,
    values,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);
  const offset = (filters.page - 1) * filters.limit;

  const result = await pool.query<AuditLogRecord>(
    `SELECT
       id,
       actor_id,
       action,
       entity_type,
       entity_id,
       old_values,
       new_values,
       created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, filters.limit, offset],
  );

  return {
    logs: result.rows,
    total,
  };
}

//get all users for admin
export async function findUsers(
  filters: AdminUserListFilters,
): Promise<{ users: AdminUserListRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const normalizedQuery = filters.q?.trim();

  if (normalizedQuery) {
    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedQuery}%`;

    values.push(pattern, pattern);
    conditions.push(
      `(u.full_name ILIKE $${values.length - 1} OR u.email ILIKE $${values.length})`,
    );
  }

  if (filters.role) {
    values.push(filters.role);
    conditions.push(`u.role = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`u.status = $${values.length}`);
  }
  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`u.created_at >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(
      `u.created_at < ($${values.length}::date + INTERVAL '1 day')`,
    );
  }

  if (filters.emailVerified !== undefined) {
    conditions.push(
      filters.emailVerified === "true"
        ? "u.email_verified_at IS NOT NULL"
        : "u.email_verified_at IS NULL",
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM users u
     ${whereClause}`,
    values,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);
  const offset = (filters.page - 1) * filters.limit;

  const result = await pool.query<AdminUserListRecord>(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       COALESCE(bp.phone_number, ap.phone_number, dp.contact_phone) AS phone,
       u.role,
       u.status,
       u.email_verified_at AS "emailVerifiedAt",
       u.created_at AS "createdAt"
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     LEFT JOIN developer_profiles dp ON dp.user_id = u.id
     ${whereClause}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, filters.limit, offset],
  );

  return {
    users: result.rows,
    total,
  };
}

//export all users for admin
export async function findUsersForExport(
  filters: AdminUserListFilters,
): Promise<AdminUserListRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const normalizedQuery = filters.q?.trim();

  if (normalizedQuery) {
    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedQuery}%`;

    values.push(pattern, pattern);
    conditions.push(
      `(u.full_name ILIKE $${values.length - 1} OR u.email ILIKE $${values.length})`,
    );
  }

  if (filters.role) {
    values.push(filters.role);
    conditions.push(`u.role = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`u.status = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`u.created_at >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(
      `u.created_at < ($${values.length}::date + INTERVAL '1 day')`,
    );
  }

  if (filters.emailVerified !== undefined) {
    conditions.push(
      filters.emailVerified === "true"
        ? "u.email_verified_at IS NOT NULL"
        : "u.email_verified_at IS NULL",
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query<AdminUserListRecord>(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       COALESCE(bp.phone_number, ap.phone_number, dp.contact_phone) AS phone,
       u.role,
       u.status,
       u.email_verified_at AS "emailVerifiedAt",
       u.created_at AS "createdAt"
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     LEFT JOIN developer_profiles dp ON dp.user_id = u.id
     ${whereClause}
     ORDER BY u.created_at DESC, u.id DESC`,
    values,
  );

  return result.rows;
}

export async function findUserByIdDetail(
  userId: string,
): Promise<AdminUserDetailRecord | null> {
  const result = await pool.query<AdminUserDetailRecord>(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       COALESCE(bp.phone_number, ap.phone_number, dp.contact_phone) AS phone,
       u.role,
       u.status,
       u.email_verified_at AS "emailVerifiedAt",
       u.created_at AS "createdAt",
       u.updated_at AS "updatedAt",
       jsonb_build_object(
         'buyer', CASE
           WHEN u.role = 'buyer' THEN jsonb_build_object(
             'phoneNumber', bp.phone_number,
             'preferredContactMethod', bp.preferred_contact_method
           )
           ELSE NULL
         END,
         'agent', CASE
           WHEN u.role = 'agent' THEN jsonb_build_object(
             'phoneNumber', ap.phone_number,
             'agencyName', ap.agency_name,
             'bio', ap.bio,
             'yearsOfExperience', ap.years_of_experience
           )
           ELSE NULL
         END,
         'developer', CASE
           WHEN u.role = 'developer' THEN jsonb_build_object(
             'companyName', dp.company_name,
             'companyDescription', dp.company_description,
             'contactPhone', dp.contact_phone,
             'businessAddress', dp.business_address,
             'websiteUrl', dp.website_url
           )
           ELSE NULL
         END
       ) AS profile
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     LEFT JOIN developer_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function findUserByEmailAdmin(
  email: string,
): Promise<AdminUserRow | null> {
  const result = await pool.query<AdminUserRow>(
    `SELECT *
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function insertAdminUser(
  input: Omit<AdminUserCreateInput, "password"> & { passwordHash: string },
  client: Pool | PoolClient = pool,
): Promise<AdminUserRow> {
  const result = await client.query<AdminUserRow>(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       status,
       email_verified_at
     )
     VALUES ($1, $2, $3, $4::app_role, $5::account_status, NOW())
     RETURNING *`,
    [input.fullName, input.email, input.passwordHash, input.role, "approved"],
  );

  const createdUser = result.rows[0];

  if (!createdUser) {
    throw new Error("Failed to create admin user");
  }

  return createdUser;
}

export async function findUserForStatusUpdate(
  userId: string,
  client: Pool | PoolClient,
): Promise<(AdminUserRow & { phone: string | null }) | null> {
  const result = await client.query<AdminUserRow & { phone: string | null }>(
    `SELECT u.*, COALESCE(bp.phone_number, ap.phone_number, dp.contact_phone) AS phone
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     LEFT JOIN developer_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1
     FOR UPDATE`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function findLatestVerificationRequestStatus(
  userId: string,
  client: Pool | PoolClient,
): Promise<"approved" | "pending" | "rejected" | null> {
  const result = await client.query<{
    status: "approved" | "pending" | "rejected";
  }>(
    `SELECT status
     FROM account_verification_requests
     WHERE user_id = $1
     ORDER BY submitted_at DESC, id DESC
     LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.status ?? null;
}

export async function revokeUserRefreshTokens(
  userId: string,
  client: Pool | PoolClient,
): Promise<void> {
  await client.query(
    `DELETE FROM refresh_tokens
     WHERE user_id = $1`,
    [userId],
  );
}

export async function updateUserStatusByAdmin(
  userId: string,
  status: "approved" | "pending" | "suspended" | "deactivated",
  client: Pool | PoolClient,
): Promise<AdminUserRow & { phone: string | null }> {
  const result = await client.query<AdminUserRow & { phone: string | null }>(
    `UPDATE users u
     SET status = $2::account_status,
         updated_at = NOW()
     FROM (
       SELECT u.id,
              COALESCE(bp.phone_number, ap.phone_number, dp.contact_phone) AS phone
       FROM users u
       LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
       LEFT JOIN agent_profiles ap ON ap.user_id = u.id
       LEFT JOIN developer_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1
     ) src
     WHERE u.id = src.id
     RETURNING u.*, src.phone`,
    [userId, status],
  );

  const updatedUser = result.rows[0];

  if (!updatedUser) {
    throw new Error("Failed to update user status");
  }

  return updatedUser;
}
