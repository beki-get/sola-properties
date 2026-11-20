import { error, jsonBody, jsonResponse } from "./shared";

export const projectPaths = {
  "/api/v1/developer/projects": {
    post: {
      tags: ["Projects"],
      summary: "Create a project",
      operationId: "createDeveloperProject",
      description: "Requires an authenticated, approved developer account.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateProjectRequest"),
      responses: {
        "201": jsonResponse("Project created", "ProjectResponse"),
        "400": jsonResponse(
          "Invalid project data",
          "ProjectValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Developer role and an approved account are required"),
        "409": error("A project with this name already exists"),
        "500": error("Unexpected server error"),
      },
    },
    get: {
      tags: ["Projects"],
      summary: "List my projects",
      operationId: "getMyProjects",
      description:
        "Returns projects owned by the authenticated developer, with pagination and an optional status filter.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["active", "inactive"] },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Paginated list of my projects",
          "ProjectListResponse",
        ),
        "400": jsonResponse(
          "Invalid pagination or filter parameters",
          "ProjectValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Developer role and an approved account are required"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/developer/projects/{projectid}": {
    parameters: [
      {
        name: "projectid",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      tags: ["Projects"],
      summary: "Get one of my projects",
      operationId: "getMyProject",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse("Project details", "ProjectResponse"),
        "400": error("Invalid project ID"),
        "401": error("Authentication is required"),
        "403": error("Developer role and an approved account are required"),
        "404": error("Project not found"),
        "500": error("Unexpected server error"),
      },
    },
    patch: {
      tags: ["Projects"],
      summary: "Update my project details",
      operationId: "updateMyProject",
      description:
        "Send at least one field. Omitted fields remain unchanged; description can be set to null.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("UpdateProjectRequest"),
      responses: {
        "200": jsonResponse("Project updated", "ProjectResponse"),
        "400": jsonResponse(
          "Invalid project ID or update data",
          "ProjectValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Developer role and an approved account are required"),
        "404": error("Project not found"),
        "409": error("A project with this name already exists"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/developer/projects/{projectid}/status": {
    parameters: [
      {
        name: "projectid",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: {
      tags: ["Projects"],
      summary: "Change my project status",
      operationId: "updateMyProjectStatus",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("UpdateProjectStatusRequest"),
      responses: {
        "200": jsonResponse("Project status updated", "ProjectResponse"),
        "400": jsonResponse(
          "Invalid project ID or status",
          "ProjectValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Developer role and an approved account are required"),
        "404": error("Project not found"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/admin/projects": {
    get: {
      tags: ["Projects"],
      summary: "List all projects",
      operationId: "getAllProjectsAdmin",
      description: "Requires an authenticated admin account.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["active", "inactive"] },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Paginated list of all projects",
          "ProjectListResponse",
        ),
        "400": jsonResponse(
          "Invalid pagination or filter parameters",
          "ProjectValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Admin role is required"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/admin/projects/{projectid}": {
    parameters: [
      {
        name: "projectid",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      tags: ["Projects"],
      summary: "Get any project by ID",
      operationId: "getProjectAdmin",
      description: "Requires an authenticated admin account.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse("Project details", "ProjectResponse"),
        "400": error("Invalid project ID"),
        "401": error("Authentication is required"),
        "403": error("Admin role is required"),
        "404": error("Project not found"),
        "500": error("Unexpected server error"),
      },
    },
  },

  "/api/v1/developer/projects/{projectid}/properties": {
    get: {
      tags: ["Projects"],
      summary: "List properties belonging to a project",
      operationId: "getDeveloperProjectProperties",
      description:
        "Returns all properties belonging to a project owned by the authenticated developer, regardless of property status. Results are ordered by creation time, newest first.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "projectid",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID of the project.",
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Project properties retrieved successfully",
          "DeveloperProjectPropertiesResponse",
        ),
        "400": error("Invalid project ID or pagination parameters"),
        "401": error("Authentication is required"),
        "403": error("Developer role and an approved account are required"),
        "404": error("Project not found"),
      },
    },
  },
} as const;

export const projectSchemas = {
  Project: {
    type: "object",
    required: [
      "id",
      "developer_id",
      "name",
      "location",
      "description",
      "status",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      developer_id: { type: "string", format: "uuid" },
      name: { type: "string", maxLength: 150 },
      location: { type: "string", maxLength: 200 },
      description: { type: "string", maxLength: 5000, nullable: true },
      status: { type: "string", enum: ["active", "inactive"] },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  CreateProjectRequest: {
    type: "object",
    additionalProperties: false,
    required: ["name", "location"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 150,
        description: "Trimmed before validation.",
      },
      location: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Trimmed before validation.",
      },
      description: {
        type: "string",
        maxLength: 5000,
        nullable: true,
      },
    },
  },
  UpdateProjectRequest: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 150 },
      location: { type: "string", minLength: 1, maxLength: 200 },
      description: {
        type: "string",
        maxLength: 5000,
        nullable: true,
      },
    },
  },
  UpdateProjectStatusRequest: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["active", "inactive"] },
    },
  },
  ProjectResponse: {
    type: "object",
    required: ["project"],
    properties: {
      project: { $ref: "#/components/schemas/Project" },
    },
  },
  ProjectListResponse: {
    type: "object",
    required: ["projects", "pagination"],
    properties: {
      projects: {
        type: "array",
        items: { $ref: "#/components/schemas/Project" },
      },
      pagination: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  },
  ProjectValidationErrorResponse: {
    type: "object",
    required: ["message", "code"],
    properties: {
      message: { type: "string" },
      code: {
        type: "string",
        enum: [
          "VALIDATION_ERROR",
          "INVALID_PROJECT_ID",
          "PROJECT_NAME_ALREADY_EXISTS",
        ],
      },
      errors: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
} as const;
