import {
  changeDeveloperProjectStatus,
  createProject as insertProject,
  findDeveloperProject,
  findProjectById,
  listProjects,
  updateDeveloperProject,
} from "../queries/projectQueries";

import type { ProjectStatus } from "../queries/projectQueries";
import type {
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
} from "../schemas/projectSchemas";

export class ProjectServiceError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectServiceError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function handleDuplicateName(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ProjectServiceError(
      409,
      "PROJECT_NAME_ALREADY_EXISTS",
      "A project with this name already exists",
    );
  }

  throw error;
}

//service function for creating a new project for a developer
export async function createDeveloperProject(
  developerId: string,
  input: CreateProjectInput,
) {
  try {
    return await insertProject(developerId, input);
  } catch (error) {
    handleDuplicateName(error);
  }
}

//service function for listing projects for a developer with pagination and optional status filter
export async function getDeveloperProjects(
  developerId: string,
  query: ProjectListQuery,
) {
  const { projects, total } = await listProjects({
    developerId,
    status: query.status,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  });

  return {
    projects,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

//service function for retrieving a specific project for a developer
export async function getDeveloperProject(
  projectId: string,
  developerId: string,
) {
  const project = await findDeveloperProject(projectId, developerId);

  if (!project) {
    throw new ProjectServiceError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found",
    );
  }

  return project;
}

//service function for updating a specific project for a developer
export async function updateProjectDetails(
  projectId: string,
  developerId: string,
  input: UpdateProjectInput,
) {
  try {
    const project = await updateDeveloperProject(projectId, developerId, input);

    if (!project) {
      throw new ProjectServiceError(
        404,
        "PROJECT_NOT_FOUND",
        "Project not found",
      );
    }

    return project;
  } catch (error) {
    handleDuplicateName(error);
  }
}

//service function for changing the status of a specific project for a developer
export async function setDeveloperProjectStatus(
  projectId: string,
  developerId: string,
  actorId: string,
  status: ProjectStatus,
) {
  const project = await changeDeveloperProjectStatus(
    projectId,
    developerId,
    actorId,
    status,
  );

  if (!project) {
    throw new ProjectServiceError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found",
    );
  }

  return project;
}

//service function for listing all projects for an admin with pagination and optional status filter
export async function getAdminProjects(query: ProjectListQuery) {
  const { projects, total } = await listProjects({
    status: query.status,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  });

  return {
    projects,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

//service function for retrieving a specific project for an admin
export async function getAdminProject(projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new ProjectServiceError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found",
    );
  }

  return project;
}
