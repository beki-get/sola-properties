import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../config/database";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/projectSchemas";

export type ProjectStatus = "active" | "inactive";

export interface Project extends QueryResultRow {
  id: string;
  developer_id: string;
  name: string;
  location: string;
  description: string | null;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;
}

interface ListProjectsOptions {
  developerId?: string;
  status?: ProjectStatus;
  limit: number;
  offset: number;
}

//create a new project for a developer
export async function createProject(
  developerId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const result = await pool.query<Project>(
    `INSERT INTO projects (developer_id, name, location, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [developerId, input.name, input.location, input.description ?? null],
  );

  return result.rows[0]!;
}

//list all projects for a developer with pagination and optional status filter
export async function listProjects(
  options: ListProjectsOptions,
): Promise<{ projects: Project[]; total: number }> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (options.developerId !== undefined) {
    values.push(options.developerId);
    conditions.push(`developer_id = $${values.length}`);
  }

  if (options.status !== undefined) {
    values.push(options.status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM projects
     ${whereClause}`,
    values,
  );

  const total = countResult.rows[0]?.total ?? 0;

  const paginationValues = [...values, options.limit, options.offset];
  const limitPlaceholder = paginationValues.length - 1;
  const offsetPlaceholder = paginationValues.length;

  const result = await pool.query<Project>(
    `SELECT *
     FROM projects
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPlaceholder}
     OFFSET $${offsetPlaceholder}`,
    paginationValues,
  );

  return { projects: result.rows, total };
}

//find a project by its ID
export async function findProjectById(
  projectId: string,
): Promise<Project | null> {
  const result = await pool.query<Project>(
    `SELECT * FROM projects WHERE id = $1`,
    [projectId],
  );

  return result.rows[0] ?? null;
}

//find a project by its ID and developer ID
export async function findDeveloperProject(
  projectId: string,
  developerId: string,
): Promise<Project | null> {
  const result = await pool.query<Project>(
    `SELECT *
     FROM projects
     WHERE id = $1 AND developer_id = $2`,
    [projectId, developerId],
  );

  return result.rows[0] ?? null;
}

//update a project for a developer
export async function updateDeveloperProject(
  projectId: string,
  developerId: string,
  input: UpdateProjectInput,
): Promise<Project | null> {
  const assignments: string[] = [];
  const values: (string | null)[] = [projectId, developerId];

  if (input.name !== undefined) {
    values.push(input.name);
    assignments.push(`name = $${values.length}`);
  }

  if (input.location !== undefined) {
    values.push(input.location);
    assignments.push(`location = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    assignments.push(`description = $${values.length}`);
  }

  assignments.push("updated_at = NOW()");

  const result = await pool.query<Project>(
    `UPDATE projects
     SET ${assignments.join(", ")}
     WHERE id = $1 AND developer_id = $2
     RETURNING *`,
    values,
  );

  return result.rows[0] ?? null;
}

//change the status of a project for a developer and log the change in an audit table
export async function changeDeveloperProjectStatus(
  projectId: string,
  developerId: string,
  actorId: string,
  newStatus: ProjectStatus,
): Promise<Project | null> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<Project>(
      `SELECT *
       FROM projects
       WHERE id = $1 AND developer_id = $2
       FOR UPDATE`,
      [projectId, developerId],
    );

    const currentProject = currentResult.rows[0];

    if (!currentProject) {
      await client.query("COMMIT");
      return null;
    }

    // Idempotent: no audit entry if the status is already correct.
    if (currentProject.status === newStatus) {
      await client.query("COMMIT");
      return currentProject;
    }

    const updatedResult = await client.query<Project>(
      `UPDATE projects
       SET status = $3, updated_at = NOW()
       WHERE id = $1 AND developer_id = $2
       RETURNING *`,
      [projectId, developerId, newStatus],
    );

    const updatedProject = updatedResult.rows[0]!;

    await client.query(
      `INSERT INTO audit_logs (
     actor_id,
     action,
     entity_type,
     entity_id,
     old_values,
     new_values
   )
   VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        "PROJECT_STATUS_CHANGED",
        "project",
        projectId,
        JSON.stringify({ status: currentProject.status }),
        JSON.stringify({ status: newStatus }),
      ],
    );

    await client.query("COMMIT");
    return updatedProject;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
