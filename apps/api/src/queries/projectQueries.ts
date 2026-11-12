import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../config/database";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/projectSchemas";

import { writeAuditLog } from "../utils/auditLog";

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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<Project>(
      `INSERT INTO projects (developer_id, name, location, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [developerId, input.name, input.location, input.description ?? null],
    );

    const project = result.rows[0]!;

    await writeAuditLog(client, {
      actorId: developerId,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      oldValues: null,
      newValues: {
        name: project.name,
        location: project.location,
        description: project.description,
        status: project.status,
      },
    });

    await client.query("COMMIT");
    return project;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  const client = await pool.connect();

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

    const assignments: string[] = [];
    const values: (string | null)[] = [projectId, developerId];
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== currentProject.name) {
      values.push(input.name);
      assignments.push(`name = $${values.length}`);
      oldValues.name = currentProject.name;
      newValues.name = input.name;
    }

    if (
      input.location !== undefined &&
      input.location !== currentProject.location
    ) {
      values.push(input.location);
      assignments.push(`location = $${values.length}`);
      oldValues.location = currentProject.location;
      newValues.location = input.location;
    }

    if (
      input.description !== undefined &&
      input.description !== currentProject.description
    ) {
      values.push(input.description);
      assignments.push(`description = $${values.length}`);
      oldValues.description = currentProject.description;
      newValues.description = input.description;
    }

    if (assignments.length === 0) {
      await client.query("COMMIT");
      return currentProject;
    }

    assignments.push("updated_at = NOW()");

    const result = await client.query<Project>(
      `UPDATE projects
       SET ${assignments.join(", ")}
       WHERE id = $1 AND developer_id = $2
       RETURNING *`,
      values,
    );

    const updatedProject = result.rows[0]!;

    await writeAuditLog(client, {
      actorId: developerId,
      action: "project.updated",
      entityType: "project",
      entityId: projectId,
      oldValues,
      newValues,
    });

    await client.query("COMMIT");
    return updatedProject;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
    await writeAuditLog(client, {
      actorId,
      action: "project.status_changed",
      entityType: "project",
      entityId: projectId,
      oldValues: {
        status: currentProject.status,
      },
      newValues: {
        status: newStatus,
      },
    });

    await client.query("COMMIT");
    return updatedProject;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
