import type { QueryResultRow } from "pg";
import { pool } from "../config/database";

export class PropertyAuthorizationError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "PropertyAuthorizationError";
  }
}

export interface ListOptions {
  page: number;
  limit: number;
  search?: string;
  status?: "active" | "revoked";
  location?: string;
  propertyType?: string;
}

export interface AgentSummary extends QueryResultRow {
  id: string;
  full_name: string;
  status: string;
  agency_name: string | null;
  bio?: string | null;
  years_of_experience?: number | null;
  authorization_status?: "active" | "revoked";
  authorized_at?: Date;
}

export interface AuthorizedProperty extends QueryResultRow {
  id: string;
  title: string;
  description: string | null;
  property_type: string;
  location: string;
  size_sqm: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: string | number | null;
  payment_plan: string | null;
  status: string;
  project_id: string | null;
  authorized_at: Date;
}

export async function authorizeAgent(
  propertyId: string,
  developerId: string,
  agentId: string,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const property = await client.query<{
      id: string;
      status: string;
    }>(
      `SELECT id, status
       FROM properties
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [propertyId, developerId],
    );

    if (!property.rows[0]) {
      throw new PropertyAuthorizationError(
        404,
        "PROPERTY_NOT_FOUND",
        "Property not found.",
      );
    }

    if (property.rows[0].status !== "active") {
      throw new PropertyAuthorizationError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Only active properties can be assigned to agents for marketing.",
      );
    }

    const agent = await client.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'agent'
         AND status = 'approved'
         AND email_verified_at IS NOT NULL`,
      [agentId],
    );

    if (!agent.rows[0]) {
      throw new PropertyAuthorizationError(
        404,
        "APPROVED_AGENT_NOT_FOUND",
        "Approved agent not found.",
      );
    }

    if (agentId === developerId) {
      throw new PropertyAuthorizationError(
        400,
        "SELF_AUTHORIZATION_NOT_ALLOWED",
        "Developers cannot authorize themselves as agents.",
      );
    }

    const existing = await client.query<{
      id: string;
      status: "active" | "revoked";
    }>(
      `SELECT id, status
       FROM property_agent_authorizations
       WHERE property_id = $1 AND agent_id = $2
       FOR UPDATE`,
      [propertyId, agentId],
    );

    if (existing.rows[0]?.status === "active") {
      throw new PropertyAuthorizationError(
        409,
        "AGENT_ALREADY_AUTHORIZED",
        "This agent is already authorized for this property.",
      );
    }

    let result;

    if (existing.rows[0]) {
      result = await client.query(
        `UPDATE property_agent_authorizations
         SET status = 'active',
             authorized_by = $3,
             updated_at = NOW()
         WHERE property_id = $1 AND agent_id = $2
         RETURNING id, property_id, agent_id, authorized_by,
                   status, created_at, updated_at`,
        [propertyId, agentId, developerId],
      );
    } else {
      result = await client.query(
        `INSERT INTO property_agent_authorizations
           (property_id, agent_id, authorized_by)
         VALUES ($1, $2, $3)
         RETURNING id, property_id, agent_id, authorized_by,
                   status, created_at, updated_at`,
        [propertyId, agentId, developerId],
      );
    }

    await client.query(
      `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        developerId,
        existing.rows[0]
          ? "property.agent_authorization_reactivated"
          : "property.agent_authorized",
        "property_agent_authorization",
        result.rows[0].id,
        existing.rows[0] ? JSON.stringify({ status: "revoked" }) : null,
        JSON.stringify({
          property_id: propertyId,
          agent_id: agentId,
          status: "active",
        }),
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAuthorizedAgents(
  propertyId: string,
  developerId: string,
  options: ListOptions,
) {
  const property = await pool.query(
    `SELECT id
     FROM properties
     WHERE id = $1 AND owner_id = $2`,
    [propertyId, developerId],
  );

  if (!property.rows[0]) {
    throw new PropertyAuthorizationError(
      404,
      "PROPERTY_NOT_FOUND",
      "Property not found.",
    );
  }

  const values: unknown[] = [propertyId];
  const where = ["paa.property_id = $1"];

  if (options.status) {
    values.push(options.status);
    where.push(`paa.status = $${values.length}`);
  }

  if (options.search) {
    values.push(`%${options.search}%`);
    where.push(
      `(u.full_name ILIKE $${values.length}
        OR ap.agency_name ILIKE $${values.length})`,
    );
  }

  const whereSql = where.join(" AND ");

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM property_agent_authorizations paa
     JOIN users u ON u.id = paa.agent_id
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE ${whereSql}`,
    values,
  );

  values.push(options.limit, (options.page - 1) * options.limit);

  const result = await pool.query<AgentSummary>(
    `SELECT u.id, u.full_name, u.status, ap.agency_name,
            paa.status AS authorization_status,
            paa.created_at AS authorized_at
     FROM property_agent_authorizations paa
     JOIN users u ON u.id = paa.agent_id
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE ${whereSql}
     ORDER BY paa.created_at DESC
     LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
    values,
  );

  return {
    items: result.rows,
    pagination: {
      page: options.page,
      limit: options.limit,
      total: Number(count.rows[0]?.count ?? 0),
    },
  };
}

export async function revokeAgentAuthorization(
  propertyId: string,
  developerId: string,
  agentId: string,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const property = await client.query(
      `SELECT id
       FROM properties
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [propertyId, developerId],
    );

    if (!property.rows[0]) {
      throw new PropertyAuthorizationError(
        404,
        "PROPERTY_NOT_FOUND",
        "Property not found.",
      );
    }

    const auth = await client.query<{
      id: string;
      status: string;
    }>(
      `SELECT id, status
       FROM property_agent_authorizations
       WHERE property_id = $1 AND agent_id = $2
       FOR UPDATE`,
      [propertyId, agentId],
    );

    if (!auth.rows[0]) {
      throw new PropertyAuthorizationError(
        404,
        "AUTHORIZATION_NOT_FOUND",
        "Authorization not found.",
      );
    }

    if (auth.rows[0].status === "revoked") {
      throw new PropertyAuthorizationError(
        409,
        "AUTHORIZATION_ALREADY_REVOKED",
        "This authorization has already been revoked.",
      );
    }

    const result = await client.query(
      `UPDATE property_agent_authorizations
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1
       RETURNING id, property_id, agent_id, authorized_by,
                 status, created_at, updated_at`,
      [auth.rows[0].id],
    );

    await client.query(
      `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, old_values, new_values)
       VALUES (
         $1,
         'property.agent_authorization_revoked',
         'property_agent_authorization',
         $2,
         $3::jsonb,
         $4::jsonb
       )`,
      [
        developerId,
        auth.rows[0].id,
        JSON.stringify({ status: "active" }),
        JSON.stringify({
          property_id: propertyId,
          agent_id: agentId,
          status: "revoked",
        }),
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAgentAuthorizedProperties(
  agentId: string,
  options: ListOptions,
) {
  const values: unknown[] = [agentId];
  const where = [
    "paa.agent_id = $1",
    "paa.status = 'active'",
    "p.status = 'active'",
  ];

  if (options.search) {
    values.push(`%${options.search}%`);
    where.push(
      `(p.title ILIKE $${values.length}
        OR p.location ILIKE $${values.length})`,
    );
  }

  if (options.location) {
    values.push(`%${options.location}%`);
    where.push(`p.location ILIKE $${values.length}`);
  }

  if (options.propertyType) {
    values.push(options.propertyType);
    where.push(`p.property_type = $${values.length}`);
  }

  const whereSql = where.join(" AND ");

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM property_agent_authorizations paa
     JOIN properties p ON p.id = paa.property_id
     WHERE ${whereSql}`,
    values,
  );

  values.push(options.limit, (options.page - 1) * options.limit);

  const result = await pool.query<AuthorizedProperty>(
    `SELECT p.id, p.title, p.description, p.property_type,
            p.location, p.size_sqm, p.bedrooms, p.bathrooms,
            p.price, p.payment_plan, p.status, p.project_id,
            paa.created_at AS authorized_at
     FROM property_agent_authorizations paa
     JOIN properties p ON p.id = paa.property_id
     WHERE ${whereSql}
     ORDER BY paa.created_at DESC
     LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
    values,
  );

  return {
    items: result.rows,
    pagination: {
      page: options.page,
      limit: options.limit,
      total: Number(count.rows[0]?.count ?? 0),
    },
  };
}

export async function listApprovedAgents(options: ListOptions) {
  const values: unknown[] = [];
  const where = [
    "u.role = 'agent'",
    "u.status = 'approved'",
    "u.email_verified_at IS NOT NULL",
  ];

  if (options.search) {
    values.push(`%${options.search}%`);
    where.push(
      `(u.full_name ILIKE $${values.length}
        OR ap.agency_name ILIKE $${values.length})`,
    );
  }

  const whereSql = where.join(" AND ");

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM users u
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE ${whereSql}`,
    values,
  );

  values.push(options.limit, (options.page - 1) * options.limit);

  const result = await pool.query<AgentSummary>(
    `SELECT u.id, u.full_name, u.status, ap.agency_name,
            ap.bio, ap.years_of_experience
     FROM users u
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE ${whereSql}
     ORDER BY u.full_name ASC
     LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
    values,
  );

  return {
    items: result.rows,
    pagination: {
      page: options.page,
      limit: options.limit,
      total: Number(count.rows[0]?.count ?? 0),
    },
  };
}

export async function getApprovedAgent(agentId: string) {
  const result = await pool.query<AgentSummary>(
    `SELECT u.id, u.full_name, u.status, ap.agency_name,
            ap.bio, ap.years_of_experience
     FROM users u
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE u.id = $1
       AND u.role = 'agent'
       AND u.status = 'approved'
       AND u.email_verified_at IS NOT NULL
     LIMIT 1`,
    [agentId],
  );

  if (!result.rows[0]) {
    throw new PropertyAuthorizationError(
      404,
      "APPROVED_AGENT_NOT_FOUND",
      "Approved agent not found.",
    );
  }

  return result.rows[0];
}
