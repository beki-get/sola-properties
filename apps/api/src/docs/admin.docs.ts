
import { error, jsonBody, jsonResponse } from "./shared";

const userIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "Unique ID of the user.",
  schema: { type: "string", format: "uuid" },
};

const lookupIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "Unique ID of the property category or location.",
  schema: { type: "string", format: "uuid" },
};

const userRoles = [
  "buyer",
  "agent",
  "developer",
  "admin",
  "finance_admin",
];

const userStatuses = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "deactivated",
];

const userListParameters = [
  {
    name: "q",
    in: "query",
    required: false,
    description: "Search by user full name or email. Maximum 100 characters.",
    schema: { type: "string", maxLength: 100 },
  },
  {
    name: "role",
    in: "query",
    required: false,
    schema: { type: "string", enum: userRoles },
  },
  {
    name: "status",
    in: "query",
    required: false,
    schema: { type: "string", enum: userStatuses },
  },
  {
    name: "dateFrom",
    in: "query",
    required: false,
    description: "Filter users registered on or after this date.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "dateTo",
    in: "query",
    required: false,
    description: "Filter users registered on or before this date.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "emailVerified",
    in: "query",
    required: false,
    description: "Filter by email verification status.",
    schema: { type: "string", enum: ["true", "false"] },
  },
];

const userPaginationParameters = [
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
    schema: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      default: 20,
    },
  },
];

const auditLogParameters = [
  {
    name: "actor_id",
    in: "query",
    required: false,
    schema: { type: "string", format: "uuid" },
  },
  {
    name: "action",
    in: "query",
    required: false,
    schema: { type: "string", minLength: 1, maxLength: 150 },
  },
  {
    name: "entity_type",
    in: "query",
    required: false,
    schema: { type: "string", minLength: 1, maxLength: 100 },
  },
  {
    name: "entity_id",
    in: "query",
    required: false,
    schema: { type: "string", format: "uuid" },
  },
  {
    name: "start_date",
    in: "query",
    required: false,
    description: "Filter audit logs from this timestamp, inclusive.",
    schema: { type: "string", format: "date-time" },
  },
  {
    name: "end_date",
    in: "query",
    required: false,
    description: "Filter audit logs up to this timestamp, inclusive.",
    schema: { type: "string", format: "date-time" },
  },
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
  schema: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
  },
},
];

const userCsvResponse = {
  description: "User CSV export generated successfully.",
  headers: {
    "Content-Disposition": {
      description: "Download filename.",
      schema: {
        type: "string",
        example: 'attachment; filename="sola-users.csv"',
      },
    },
    "Cache-Control": {
      schema: { type: "string", example: "no-store" },
    },
  },
  content: {
    "text/csv": {
      schema: { type: "string", format: "binary" },
    },
  },
};

export const adminPaths = {
  "/api/v1/admin/audit-logs": {
    get: {
      tags: ["Admin"],
      summary: "List audit logs",
      operationId: "getAuditLogs",
      description:
        "Returns paginated audit log records, ordered newest first. Administrators can filter by actor, action, entity type, entity ID, and creation timestamp range. The start_date must not be later than end_date.",
      security: [{ AccessToken: [] }],
      parameters: auditLogParameters,
      responses: {
        "200": jsonResponse(
          "Audit logs retrieved successfully.",
          "AuditLogsResponse",
        ),
        "400": error(
          "Invalid audit log query parameters (VALIDATION_ERROR).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/users": {
    get: {
      tags: ["Admin"],
      summary: "List users",
      operationId: "getUsers",
      description:
        "Returns paginated users with their basic account information and profile phone number. Administrators can filter by search term, role, account status, registration date range, and email verification status.",
      security: [{ AccessToken: [] }],
      parameters: [
        ...userListParameters,
        ...userPaginationParameters,
      ],
      responses: {
        "200": jsonResponse(
          "Users retrieved successfully.",
          "AdminUsersResponse",
        ),
        "400": error("Invalid admin user query parameters (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },

    post: {
      tags: ["Admin"],
      summary: "Create an administrator account",
      operationId: "createAdminUser",
      description:
        "Allows an administrator to create an admin or finance_admin account. The created account is approved and its email is marked as verified. The password is securely hashed before being stored.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("AdminUserCreateRequest"),
      responses: {
        "201": jsonResponse(
          "Administrator account created successfully.",
          "AdminUserMutationResponse",
        ),
        "400": error("Invalid user payload (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "409": error("An account with this email already exists (EMAIL_ALREADY_REGISTERED)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/users/export": {
    get: {
      tags: ["Admin"],
      summary: "Export users as CSV",
      operationId: "exportUsers",
      description:
        "Downloads a CSV file of users matching the supplied search, role, status, registration-date, and email-verification filters. The export includes user IDs, names, email addresses, phone numbers, roles, account statuses, email verification dates, and registration dates.",
      security: [{ AccessToken: [] }],
      parameters: userListParameters,
      responses: {
        "200": userCsvResponse,
        "400": error("Invalid admin user export parameters (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/users/{id}": {
    parameters: [userIdParameter],
    get: {
      tags: ["Admin"],
      summary: "Get user details",
      operationId: "getUserById",
      description:
        "Returns detailed information about a user, including their role-specific buyer, agent, or developer profile when applicable.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "User details retrieved successfully.",
          "AdminUserDetail",
        ),
        "400": error("Invalid user ID (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "404": error("User not found (USER_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/users/{id}/status": {
    parameters: [userIdParameter],
    patch: {
      tags: ["Admin"],
      summary: "Update a user's account status",
      operationId: "updateUserStatus",
      description:
        "Allows an administrator to suspend, deactivate, or reactivate another user's account. Suspension and deactivation require a reason and revoke the user's refresh tokens. Reactivation sets buyers and administrative accounts to approved; agents and developers are restored to approved only when their latest verification request was approved, otherwise they return to pending. Administrators cannot change their own account status.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("AdminUserStatusUpdateRequest"),
      responses: {
        "200": jsonResponse(
          "User account status updated successfully.",
          "AdminUserMutationResponse",
        ),
        "400": error("Invalid user ID or status update payload (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error(
          "Administrators cannot change their own account status (SELF_STATUS_CHANGE_FORBIDDEN).",
        ),
        "404": error("User not found (USER_NOT_FOUND)."),
        "409": error("The requested account status transition is invalid (INVALID_STATUS_TRANSITION)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/properties/categories": {
    post: {
      tags: ["Admin"],
      summary: "Create a property category",
      operationId: "createPropertyCategory",
      description:
        "Creates a property category with the supplied name and records the administrative action in the audit log.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("PropertyLookupCreateRequest"),
      responses: {
        "201": jsonResponse(
          "Property category created successfully.",
          "PropertyLookup",
        ),
        "400": error("Invalid property category payload (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/properties/categories/{id}": {
    parameters: [lookupIdParameter],
    patch: {
      tags: ["Admin"],
      summary: "Update a property category",
      operationId: "updatePropertyCategory",
      description:
        "Updates the name or active status of an existing property category. At least one field must be supplied. The operation is recorded in the audit log.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("PropertyLookupUpdateRequest"),
      responses: {
        "200": jsonResponse(
          "Property category updated successfully.",
          "PropertyLookup",
        ),
        "400": error("Invalid category ID or update payload (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "404": error("Property category not found (LOOKUP_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/properties/locations": {
    post: {
      tags: ["Admin"],
      summary: "Create a property location",
      operationId: "createPropertyLocation",
      description:
        "Creates a property location with the supplied name and records the administrative action in the audit log.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("PropertyLookupCreateRequest"),
      responses: {
        "201": jsonResponse(
          "Property location created successfully.",
          "PropertyLookup",
        ),
        "400": error("Invalid property location payload (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/admin/properties/locations/{id}": {
    parameters: [lookupIdParameter],
    patch: {
      tags: ["Admin"],
      summary: "Update a property location",
      operationId: "updatePropertyLocation",
      description:
        "Updates the name or active status of an existing property location. At least one field must be supplied. The operation is recorded in the audit log.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("PropertyLookupUpdateRequest"),
      responses: {
        "200": jsonResponse(
          "Property location updated successfully.",
          "PropertyLookup",
        ),
        "400": error("Invalid location ID or update payload (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "404": error("Property location not found (LOOKUP_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },
} as const;


export const adminSchemas = {
  AuditLogRecord: {
    type: "object",
    required: [
      "id",
      "actor_id",
      "action",
      "entity_type",
      "entity_id",
      "old_values",
      "new_values",
      "created_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      actor_id: { type: "string", format: "uuid", nullable: true },
      action: { type: "string" },
      entity_type: { type: "string" },
      entity_id: { type: "string" },
      old_values: {
        nullable: true,
        description: "Previous entity values stored in the audit record.",
      },
      new_values: {
        nullable: true,
        description: "New entity values stored in the audit record.",
      },
      created_at: { type: "string", format: "date-time" },
    },
  },

  AuditLogPagination: {
    type: "object",
    required: ["page", "limit", "total", "totalPages"],
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer", minimum: 0 },
      totalPages: { type: "integer", minimum: 0 },
    },
  },

  AuditLogsResponse: {
    type: "object",
    required: ["logs", "pagination"],
    properties: {
      logs: {
        type: "array",
        items: { $ref: "#/components/schemas/AuditLogRecord" },
      },
      pagination: {
        $ref: "#/components/schemas/AuditLogPagination",
      },
    },
  },

  AdminUserRecord: {
    type: "object",
    required: [
      "id",
      "fullName",
      "email",
      "phone",
      "role",
      "status",
      "emailVerifiedAt",
      "createdAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      fullName: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string", nullable: true },
      role: {
        type: "string",
        enum: userRoles,
      },
      status: {
        type: "string",
        enum: userStatuses,
      },
      emailVerifiedAt: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  AdminUsersPagination: {
    type: "object",
    required: ["page", "limit", "total", "totalPages"],
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 50 },
      total: { type: "integer", minimum: 0 },
      totalPages: { type: "integer", minimum: 0 },
    },
  },

  AdminUsersResponse: {
    type: "object",
    required: ["data", "pagination"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/AdminUserRecord" },
      },
      pagination: {
        $ref: "#/components/schemas/AdminUsersPagination",
      },
    },
  },

  AdminUserCreateRequest: {
    type: "object",
    required: ["fullName", "email", "password", "role"],
    properties: {
      fullName: {
        type: "string",
        minLength: 2,
        maxLength: 150,
      },
      email: {
        type: "string",
        format: "email",
        maxLength: 255,
        description: "Email is normalized to lowercase.",
      },
     
      password: {
        type: "string",
        minLength: 8,
        maxLength: 128,
      },
      role: {
        type: "string",
        enum: ["admin", "finance_admin"],
      },
    },
    additionalProperties: false,
    example: {
      fullName: "Alex Morgan",
      email: "alex@example.com",
      password: "SecurePassword123",
      role: "finance_admin",
    },
  },

  AdminUserMutationResponse: {
    type: "object",
    required: [
      "id",
      "fullName",
      "email",
      "role",
      "status",
      "emailVerifiedAt",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      fullName: { type: "string" },
      email: { type: "string", format: "email" },
      role: { type: "string", enum: userRoles },
      status: { type: "string", enum: userStatuses },
      emailVerifiedAt: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  AdminUserStatusUpdateRequest: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["suspend", "deactivate", "reactivate"],
      },
      reason: {
        type: "string",
        maxLength: 500,
        description: "Required when action is suspend or deactivate.",
      },
    },
    additionalProperties: false,
    example: {
      action: "suspend",
      reason: "Repeated violations of platform policies.",
    },
  },

  BuyerAdminProfile: {
    type: "object",
    properties: {
      phoneNumber: { type: "string", nullable: true },
      preferredContactMethod: {
        type: "string",
        enum: ["email", "phone", "whatsapp"],
        nullable: true,
      },
    },
  },

  AgentAdminProfile: {
    type: "object",
    properties: {
      phoneNumber: { type: "string", nullable: true },
      agencyName: { type: "string", nullable: true },
      bio: { type: "string", nullable: true },
      yearsOfExperience: { type: "integer", nullable: true },
    },
  },

  DeveloperAdminProfile: {
    type: "object",
    properties: {
      companyName: { type: "string", nullable: true },
      companyDescription: { type: "string", nullable: true },
      contactPhone: { type: "string", nullable: true },
      businessAddress: { type: "string", nullable: true },
      websiteUrl: {
        type: "string",
        format: "uri",
        nullable: true,
      },
    },
  },

  AdminUserProfile: {
    type: "object",
    required: ["buyer", "agent", "developer"],
    properties: {
      buyer: {
        allOf: [
          { $ref: "#/components/schemas/BuyerAdminProfile" },
        ],
        nullable: true,
      },
      agent: {
        allOf: [
          { $ref: "#/components/schemas/AgentAdminProfile" },
        ],
        nullable: true,
      },
      developer: {
        allOf: [
          { $ref: "#/components/schemas/DeveloperAdminProfile" },
        ],
        nullable: true,
      },
    },
  },

  AdminUserDetail: {
    type: "object",
    required: [
      "id",
      "fullName",
      "email",
      "phone",
      "role",
      "status",
      "emailVerifiedAt",
      "createdAt",
      "updatedAt",
      "profile",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      fullName: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string", nullable: true },
      role: { type: "string", enum: userRoles },
      status: { type: "string", enum: userStatuses },
      emailVerifiedAt: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      profile: {
        $ref: "#/components/schemas/AdminUserProfile",
      },
    },
  },

  PropertyLookupCreateRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        minLength: 2,
        maxLength: 100,
      },
    },
    additionalProperties: false,
    example: {
      name: "Residential",
    },
  },

  PropertyLookupUpdateRequest: {
    type: "object",
    minProperties: 1,
    properties: {
      name: {
        type: "string",
        minLength: 2,
        maxLength: 100,
      },
      isActive: {
        type: "boolean",
      },
    },
    additionalProperties: false,
    example: {
      name: "Luxury Residential",
      isActive: true,
    },
  },

  PropertyLookup: {
    type: "object",
    required: ["id", "name", "isActive", "createdAt", "updatedAt"],
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
} as const;
