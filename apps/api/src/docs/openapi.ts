const errorResponse = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string" },
    code: { type: "string" },
    status: { type: "string" },
  },
} as const;

const messageResponse = {
  type: "object",
  required: ["message"],
  properties: { message: { type: "string" } },
} as const;

const jsonBody = (schema: string) => ({
  required: true,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const jsonResponse = (description: string, schema: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const error = (description: string) =>
  jsonResponse(description, "ErrorResponse");

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Sola Properties API",
    version: "1.0.0",
    description:
      "Authentication, account verification, profile management, buyer preferences, and health endpoints.",
  },
  servers: [
    {
      url: "https://sola-properties.onrender.com",
      description: "Deployed API",
    },
    { url: "http://localhost:8080", description: "Local API" },
  ],
  tags: [
    { name: "Authentication", description: "Account and session operations" },
    { name: "Profiles", description: "Role-specific profile management" },
    {
      name: "Account Verification",
      description:
        "Agent and developer verification applications and admin review",
    },
    {
      name: "Projects",
      description: "Developer project management and admin project actions",
    },
    { name: "System", description: "API health" },
  ],
  paths: {
    "/": {
      get: {
        tags: ["System"],
        summary: "Check API health",
        operationId: "healthCheck",
        responses: {
          "200": jsonResponse("API is running", "HealthResponse"),
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register an account",
        operationId: "register",
        requestBody: jsonBody("RegisterRequest"),
        responses: {
          "201": jsonResponse(
            "Account created; verification email may have been sent",
            "RegisterResponse",
          ),
          "400": error("Invalid registration data"),
          "409": error("An account already exists for this email"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Log in",
        operationId: "login",
        requestBody: jsonBody("LoginRequest"),
        responses: {
          "200": {
            ...jsonResponse(
              "Access token returned and refresh token set as an HttpOnly cookie",
              "LoginResponse",
            ),
            headers: {
              "Set-Cookie": {
                description:
                  "Sets the sola_refresh_token cookie (HttpOnly, SameSite=Lax, seven-day lifetime).",
                schema: { type: "string" },
              },
            },
          },
          "400": error("Invalid login input"),
          "401": error("Invalid email or password"),
          "403": error("Email verification or account approval is required"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/auth/verify-email": {
      post: {
        tags: ["Authentication"],
        summary: "Verify an email address",
        operationId: "verifyEmail",
        requestBody: jsonBody("TokenRequest"),
        responses: {
          "200": jsonResponse("Email verified", "VerifiedEmailResponse"),
          "400": error("Verification token is invalid or expired"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/auth/resend-verification": {
      post: {
        tags: ["Authentication"],
        summary: "Resend the verification email",
        operationId: "resendVerification",
        requestBody: jsonBody("EmailRequest"),
        responses: {
          "200": jsonResponse(
            "Request accepted without revealing whether the account exists",
            "MessageResponse",
          ),
          "400": error("Invalid email address"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get the authenticated user",
        operationId: "getCurrentUser",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse("Current user", "CurrentUserResponse"),
          "401": error("Access token is missing, invalid, or expired"),
          "403": error("Email verification or an active account is required"),
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh the access token",
        operationId: "refreshSession",
        description:
          "Reads and rotates the refresh token from the sola_refresh_token cookie.",
        security: [{ RefreshCookie: [] }],
        responses: {
          "200": {
            ...jsonResponse(
              "New access token returned and refresh cookie rotated",
              "RefreshResponse",
            ),
            headers: {
              "Set-Cookie": {
                description:
                  "Replaces the sola_refresh_token cookie with its rotated value.",
                schema: { type: "string" },
              },
            },
          },
          "401": error(
            "Refresh cookie is missing, invalid, expired, or reused",
          ),
          "403": error("Account is not approved for login"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Log out",
        operationId: "logout",
        description:
          "Revokes the refresh session when present and clears the refresh cookie.",
        responses: {
          "200": jsonResponse(
            "Logout completed and refresh cookie cleared",
            "MessageResponse",
          ),
          "500": error("Logout could not be completed"),
        },
      },
    },
    "/api/v1/auth/forgot-password": {
      post: {
        tags: ["Authentication"],
        summary: "Request password-reset instructions",
        operationId: "requestPasswordReset",
        requestBody: jsonBody("EmailRequest"),
        responses: {
          "200": jsonResponse(
            "Request accepted without revealing whether the account exists",
            "MessageResponse",
          ),
          "400": error("Invalid email address"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/auth/reset-password": {
      post: {
        tags: ["Authentication"],
        summary: "Reset a password",
        operationId: "resetPassword",
        requestBody: jsonBody("ResetPasswordRequest"),
        responses: {
          "200": jsonResponse("Password reset successfully", "MessageResponse"),
          "400": error("Invalid or expired reset token or invalid input"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/account-verification": {
      post: {
        tags: ["Account Verification"],
        summary: "Submit an agent or developer verification application",
        operationId: "submitAccountVerification",
        security: [{ AccessToken: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                $ref: "#/components/schemas/AccountVerificationApplication",
              },
            },
          },
        },
        responses: {
          "201": jsonResponse(
            "Verification application submitted",
            "VerificationSubmissionResponse",
          ),
          "400": error("Invalid application data"),
          "401": error("Authentication is required"),
          "403": error(
            "Account role, email verification, or account state is ineligible",
          ),
          "404": error("User account not found"),
          "409": error(
            "Account already approved, pending application exists, or submission limit reached",
          ),
        },
      },
    },
    "/api/v1/account-verification/me": {
      get: {
        tags: ["Account Verification"],
        summary: "Get my verification application history",
        operationId: "getMyVerificationHistory",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse(
            "Applicant verification history",
            "VerificationHistoryResponse",
          ),
          "401": error("Authentication is required"),
        },
      },
    },
    "/api/v1/admin/account-verification": {
      get: {
        tags: ["Account Verification"],
        summary: "List pending verification applications",
        operationId: "listPendingVerificationRequests",
        description:
          "Admin-only. page defaults to 1; pageSize defaults to 20 and is capped at 100.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Paginated pending applications",
            "PendingVerificationListResponse",
          ),
          "400": error("Invalid pagination values"),
          "401": error("Authentication is required"),
          "403": error("Admin role is required"),
        },
      },
    },
    "/api/v1/admin/account-verification/{requestId}": {
      get: {
        tags: ["Account Verification"],
        summary: "Get verification application details",
        operationId: "getVerificationRequestForAdmin",
        description: "Admin-only.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "requestId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Application details",
            "AdminVerificationRequestResponse",
          ),
          "400": error("Invalid request ID"),
          "401": error("Authentication is required"),
          "403": error("Admin role is required"),
          "404": error("Verification request not found"),
        },
      },
    },
    "/api/v1/admin/account-verification/{requestId}/decision": {
      patch: {
        tags: ["Account Verification"],
        summary: "Approve or reject a verification application",
        operationId: "decideVerificationRequest",
        description:
          "Admin-only. A rejection requires a non-empty rejectionReason.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "requestId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: jsonBody("VerificationDecisionRequest"),
        responses: {
          "200": jsonResponse(
            "Application decision recorded",
            "VerificationDecisionResponse",
          ),
          "400": error(
            "Invalid decision or rejection reason is missing/invalid",
          ),
          "401": error("Authentication is required"),
          "403": error("Admin role is required"),
          "404": error("Verification request or applicant not found"),
          "409": error("Request already decided or applicant state changed"),
        },
      },
    },
    "/api/v1/agent/me": {
      get: {
        tags: ["Profiles"],
        summary: "Get my agent profile",
        operationId: "getMyAgentProfile",
        description: "Requires an authenticated agent account.",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse(
            "Agent profile; profile is null before the first update",
            "AgentProfileResponse",
          ),
          "401": error("Authentication is required"),
          "403": error("Agent role is required"),
        },
      },
      patch: {
        tags: ["Profiles"],
        summary: "Create or update my agent profile",
        operationId: "updateMyAgentProfile",
        description:
          "Requires an authenticated agent account. Send at least one field.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("UpdateAgentProfileRequest"),
        responses: {
          "200": jsonResponse(
            "Agent profile updated",
            "AgentProfileUpdateResponse",
          ),
          "400": jsonResponse(
            "Invalid profile data",
            "ProfileValidationErrorResponse",
          ),
          "401": error("Authentication is required"),
          "403": error("Agent role is required"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/buyer/me": {
      get: {
        tags: ["Profiles"],
        summary: "Get my buyer profile",
        operationId: "getBuyerProfile",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse("Buyer profile", "BuyerProfileResponse"),
          "401": error("Authentication is required"),
          "403": error("Buyer role is required"),
          "404": error("Buyer profile not found"),
          "500": error("Unexpected server error"),
        },
      },
      patch: {
        tags: ["Profiles"],
        summary: "Create or update my buyer profile",
        operationId: "updateBuyerProfile",
        description:
          "Requires an authenticated buyer account. Send at least one field.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("UpdateBuyerProfileRequest"),
        responses: {
          "200": jsonResponse("Buyer profile saved", "BuyerProfileResponse"),
          "400": jsonResponse(
            "Invalid profile data",
            "BuyerProfileValidationErrorResponse",
          ),
          "401": error("Authentication is required"),
          "403": error("Buyer role is required"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/buyer/me/preferences": {
      get: {
        tags: ["Profiles"],
        summary: "Get my buyer preferences",
        operationId: "getMyBuyerPreferences",
        description:
          "Requires an authenticated buyer. preferences is null until saved.",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse("Buyer preferences", "BuyerPreferencesResponse"),
          "401": error("Authentication is required"),
          "403": error("Buyer role is required"),
        },
      },
      put: {
        tags: ["Profiles"],
        summary: "Replace my buyer preferences",
        operationId: "putMyBuyerPreferences",
        description:
          "Requires an authenticated buyer. Omitted values reset to their defaults. budget_min must not exceed budget_max.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("BuyerPreferencesInput"),
        responses: {
          "200": jsonResponse(
            "Preferences replaced",
            "BuyerPreferencesResponse",
          ),
          "400": error("Invalid preference values or budget range"),
          "401": error("Authentication is required"),
          "403": error("Buyer role is required"),
        },
      },
      patch: {
        tags: ["Profiles"],
        summary: "Update selected buyer preferences",
        operationId: "patchMyBuyerPreferences",
        description:
          "Requires an authenticated buyer. Omitted values remain unchanged. budget_min must not exceed budget_max.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("BuyerPreferencesInput"),
        responses: {
          "200": jsonResponse(
            "Preferences updated",
            "BuyerPreferencesResponse",
          ),
          "400": error("Invalid preference values or budget range"),
          "401": error("Authentication is required"),
          "403": error("Buyer role is required"),
        },
      },
    },
    "/api/v1/developer/me": {
      get: {
        tags: ["Profiles"],
        summary: "Get my developer profile",
        operationId: "getMyDeveloperProfile",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse(
            "Developer profile; profile is null before completion",
            "DeveloperProfileResponse",
          ),
          "401": error("Authentication is required"),
          "403": error("Developer role is required"),
        },
      },
      patch: {
        tags: ["Profiles"],
        summary: "Create or update my developer profile",
        operationId: "updateMyDeveloperProfile",
        description:
          "Requires an authenticated developer account. company_name, contact_phone, and business_address are required to create a profile; partial updates preserve existing values.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("UpdateDeveloperProfileRequest"),
        responses: {
          "200": jsonResponse(
            "Developer profile updated",
            "DeveloperProfileUpdateResponse",
          ),
          "400": jsonResponse(
            "Invalid data or required fields are missing",
            "DeveloperProfileValidationErrorResponse",
          ),
          "401": error("Authentication is required"),
          "403": error("Developer role is required"),
          "500": error("Unexpected server error"),
        },
      },
    },
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
  },
  components: {
    securitySchemes: {
      AccessToken: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Access token returned by POST /api/v1/auth/login or /refresh.",
      },
      RefreshCookie: {
        type: "apiKey",
        in: "cookie",
        name: "sola_refresh_token",
        description:
          "HttpOnly refresh cookie set by login and refresh; use a cookie-aware client.",
      },
    },
    schemas: {
      ErrorResponse: errorResponse,
      MessageResponse: messageResponse,
      HealthResponse: {
        type: "object",
        required: ["status", "message"],
        properties: {
          status: { type: "string", example: "ok" },
          message: { type: "string", example: "Express backend is running" },
        },
      },
      RegisterRequest: {
        type: "object",
        additionalProperties: false,
        required: ["fullName", "email", "password", "role"],
        properties: {
          fullName: {
            type: "string",
            minLength: 2,
            maxLength: 150,
            example: "Abebe Alemu",
          },
          email: {
            type: "string",
            format: "email",
            maxLength: 255,
            example: "alex@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 128,
            format: "password",
          },
          role: { type: "string", enum: ["buyer", "agent", "developer"] },
        },
      },
      LoginRequest: {
        type: "object",
        additionalProperties: false,
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 255 },
          password: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            format: "password",
          },
        },
      },
      TokenRequest: {
        type: "object",
        additionalProperties: false,
        required: ["token"],
        properties: {
          token: { type: "string", minLength: 32, maxLength: 512 },
        },
      },
      EmailRequest: {
        type: "object",
        additionalProperties: false,
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", maxLength: 255 },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        additionalProperties: false,
        required: ["token", "newPassword"],
        properties: {
          token: { type: "string", minLength: 32, maxLength: 512 },
          newPassword: {
            type: "string",
            minLength: 8,
            maxLength: 128,
            format: "password",
          },
        },
      },
      User: {
        type: "object",
        required: ["id", "fullName", "email", "role", "status"],
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string" },
          email: { type: "string", format: "email" },
          role: {
            type: "string",
            enum: ["buyer", "agent", "developer", "admin", "finance_admin"],
          },
          status: {
            type: "string",
            enum: [
              "pending",
              "approved",
              "rejected",
              "suspended",
              "deactivated",
            ],
          },
        },
      },
      CurrentUser: {
        allOf: [
          { $ref: "#/components/schemas/User" },
          {
            type: "object",
            required: ["emailVerified"],
            properties: { emailVerified: { type: "boolean", example: true } },
          },
        ],
      },
      RegisterResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: { $ref: "#/components/schemas/User" },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            required: ["accessToken", "user"],
            properties: {
              accessToken: { type: "string" },
              user: { $ref: "#/components/schemas/User" },
            },
          },
        },
      },
      VerifiedEmailResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            required: ["id", "role", "status"],
            properties: {
              id: { type: "string", format: "uuid" },
              role: { type: "string" },
              status: { type: "string" },
            },
          },
        },
      },
      CurrentUserResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: { $ref: "#/components/schemas/CurrentUser" },
        },
      },
      RefreshResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            required: ["accessToken"],
            properties: { accessToken: { type: "string" } },
          },
        },
      },
      UpdateAgentProfileRequest: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            minLength: 7,
            maxLength: 20,
            nullable: true,
          },
          agency_name: { type: "string", maxLength: 200, nullable: true },
          bio: { type: "string", maxLength: 5000, nullable: true },
          years_of_experience: { type: "integer", minimum: 0, nullable: true },
        },
        minProperties: 1,
        additionalProperties: false,
      },
      UpdateBuyerProfileRequest: {
        type: "object",
        properties: {
          phoneNumber: {
            type: "string",
            minLength: 7,
            maxLength: 20,
            nullable: true,
          },
          preferredContactMethod: {
            type: "string",
            enum: ["email", "phone", "whatsapp"],
            nullable: true,
          },
        },
        minProperties: 1,
        additionalProperties: false,
      },
      UpdateDeveloperProfileRequest: {
        type: "object",
        properties: {
          company_name: { type: "string", minLength: 1, maxLength: 200 },
          company_description: {
            type: "string",
            maxLength: 5000,
            nullable: true,
          },
          contact_phone: { type: "string", minLength: 7, maxLength: 30 },
          business_address: { type: "string", minLength: 1, maxLength: 300 },
          website_url: {
            type: "string",
            format: "uri",
            maxLength: 2048,
            nullable: true,
          },
        },
        minProperties: 1,
        additionalProperties: false,
      },
      AgentProfile: {
        type: "object",
        properties: {
          user_id: { type: "string", format: "uuid" },
          phone_number: { type: "string", nullable: true },
          agency_name: { type: "string", nullable: true },
          bio: { type: "string", nullable: true },
          years_of_experience: { type: "integer", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      BuyerProfile: {
        type: "object",
        properties: {
          userId: { type: "string", format: "uuid" },
          phoneNumber: { type: "string", nullable: true },
          preferredContactMethod: {
            type: "string",
            enum: ["email", "phone", "whatsapp"],
            nullable: true,
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      BuyerPreferencesInput: {
        type: "object",
        additionalProperties: false,
        properties: {
          budget_min: { type: "number", minimum: 0, nullable: true },
          budget_max: { type: "number", minimum: 0, nullable: true },
          property_types: {
            type: "array",
            maxItems: 10,
            uniqueItems: true,
            items: {
              type: "string",
              enum: [
                "apartment",
                "house",
                "villa",
                "land",
                "commercial",
                "townhouse",
                "condominium",
                "office",
                "retail",
                "industrial",
              ],
            },
            nullable: true,
          },
          locations: {
            type: "array",
            maxItems: 10,
            uniqueItems: true,
            items: { type: "string", minLength: 1, maxLength: 100 },
            nullable: true,
          },
          features: {
            type: "array",
            maxItems: 10,
            uniqueItems: true,
            items: {
              type: "string",
              enum: [
                "garden",
                "parking",
                "balcony",
                "elevator",
                "security",
                "swimming_pool",
                "gym",
                "storage",
                "furnished",
                "air_conditioning",
              ],
            },
            nullable: true,
          },
          min_size_sqm: {
            type: "number",
            minimum: 0,
            exclusiveMinimum: true,
            nullable: true,
          },
          min_bedrooms: { type: "integer", minimum: 1, nullable: true },
          payment_preference: {
            type: "string",
            enum: ["cash", "installment", "mortgage"],
            nullable: true,
          },
        },
      },
      BuyerPreferences: {
        type: "object",
        properties: {
          user_id: { type: "string", format: "uuid" },
          budget_min: { type: "string", nullable: true },
          budget_max: { type: "string", nullable: true },
          property_types: { type: "array", items: { type: "string" } },
          locations: { type: "array", items: { type: "string" } },
          features: { type: "array", items: { type: "string" } },
          min_size_sqm: { type: "string", nullable: true },
          min_bedrooms: { type: "integer", nullable: true },
          payment_preference: { type: "string", nullable: true },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      BuyerPreferencesResponse: {
        type: "object",
        required: ["preferences"],
        properties: {
          preferences: {
            allOf: [{ $ref: "#/components/schemas/BuyerPreferences" }],
            nullable: true,
          },
        },
      },
      DeveloperProfile: {
        type: "object",
        properties: {
          user_id: { type: "string", format: "uuid" },
          company_name: { type: "string" },
          company_description: { type: "string", nullable: true },
          contact_phone: { type: "string" },
          business_address: { type: "string" },
          website_url: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      AgentProfileResponse: {
        type: "object",
        required: ["profile"],
        properties: {
          profile: {
            allOf: [{ $ref: "#/components/schemas/AgentProfile" }],
            nullable: true,
          },
        },
      },
      AgentProfileUpdateResponse: {
        type: "object",
        required: ["message", "profile"],
        properties: {
          message: {
            type: "string",
            example: "Agent profile updated successfully",
          },
          profile: { $ref: "#/components/schemas/AgentProfile" },
        },
      },
      BuyerProfileResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: { $ref: "#/components/schemas/BuyerProfile" },
        },
      },
      DeveloperProfileResponse: {
        type: "object",
        required: ["profile"],
        properties: {
          profile: {
            allOf: [{ $ref: "#/components/schemas/DeveloperProfile" }],
            nullable: true,
          },
        },
      },
      DeveloperProfileUpdateResponse: {
        type: "object",
        required: ["message", "profile"],
        properties: {
          message: {
            type: "string",
            example: "Developer profile updated successfully",
          },
          profile: { $ref: "#/components/schemas/DeveloperProfile" },
        },
      },
      ProfileValidationErrorResponse: {
        type: "object",
        required: ["message", "code", "errors"],
        properties: {
          message: { type: "string" },
          code: { type: "string", example: "INVALID_PROFILE_DATA" },
          errors: { type: "object", additionalProperties: true },
        },
      },
      BuyerProfileValidationErrorResponse: {
        type: "object",
        required: ["message", "code", "errors"],
        properties: {
          message: { type: "string" },
          code: { type: "string", example: "VALIDATION_ERROR" },
          errors: {
            type: "array",
            items: {
              type: "object",
              required: ["field", "message"],
              properties: {
                field: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      DeveloperProfileValidationErrorResponse: {
        oneOf: [
          { $ref: "#/components/schemas/ProfileValidationErrorResponse" },
          {
            type: "object",
            required: ["message", "code", "missingFields"],
            properties: {
              message: { type: "string" },
              code: { type: "string", example: "PROFILE_FIELDS_REQUIRED" },
              missingFields: { type: "array", items: { type: "string" } },
            },
          },
        ],
      },
      AccountVerificationApplication: {
        type: "object",
        required: [
          "legalName",
          "registrationNumber",
          "businessAddress",
          "contactPhone",
        ],
        properties: {
          legalName: { type: "string", minLength: 2, maxLength: 150 },
          registrationNumber: { type: "string", minLength: 1, maxLength: 100 },
          businessName: { type: "string", maxLength: 200 },
          businessAddress: { type: "string", minLength: 2, maxLength: 300 },
          contactPhone: { type: "string", minLength: 5, maxLength: 30 },
          notes: { type: "string", maxLength: 2000 },
          documents: {
            type: "array",
            maxItems: 3,
            items: {
              type: "string",
              format: "binary",
            },
          },
        },
      },
      VerificationDocument: {
        type: "object",
        required: [
          "id",
          "original_filename",
          "mime_type",
          "file_size",
          "uploaded_at",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          original_filename: { type: "string" },
          mime_type: {
            type: "string",
            enum: ["application/pdf", "image/jpeg", "image/png"],
          },
          file_size: { type: "integer" },
          uploaded_at: { type: "string", format: "date-time" },
        },
      },
      VerificationRequest: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          applicant_role: { type: "string", enum: ["agent", "developer"] },
          legal_name: { type: "string" },
          registration_number: { type: "string" },
          business_name: { type: "string", nullable: true },
          business_address: { type: "string" },
          contact_phone: { type: "string" },
          notes: { type: "string", nullable: true },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          rejection_reason: { type: "string", nullable: true },
          reviewed_by: { type: "string", format: "uuid", nullable: true },
          reviewed_at: { type: "string", format: "date-time", nullable: true },
          submitted_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          documents: {
            type: "array",
            items: {
              $ref: "#/components/schemas/VerificationDocument",
            },
          },
        },
      },
      AdminVerificationRequest: {
        allOf: [
          { $ref: "#/components/schemas/VerificationRequest" },
          {
            type: "object",
            properties: {
              applicant_full_name: { type: "string" },
              applicant_email: { type: "string", format: "email" },
              account_status: { type: "string" },
              email_verified_at: {
                type: "string",
                format: "date-time",
                nullable: true,
                documents: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/VerificationDocument",
                  },
                },
              },
            },
          },
        ],
      },
      VerificationSubmissionResponse: {
        type: "object",
        required: ["message", "request"],
        properties: {
          message: {
            type: "string",
            example: "Verification application submitted successfully",
          },
          request: { $ref: "#/components/schemas/VerificationRequest" },
        },
      },
      VerificationHistoryResponse: {
        type: "object",
        required: ["requests"],
        properties: {
          requests: {
            type: "array",
            items: { $ref: "#/components/schemas/VerificationRequest" },
          },
        },
      },
      PendingVerificationListResponse: {
        type: "object",
        required: ["requests", "total", "page", "pageSize", "totalPages"],
        properties: {
          requests: {
            type: "array",
            items: { $ref: "#/components/schemas/AdminVerificationRequest" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      AdminVerificationRequestResponse: {
        type: "object",
        required: ["request"],
        properties: {
          request: { $ref: "#/components/schemas/AdminVerificationRequest" },
        },
      },
      VerificationDecisionRequest: {
        type: "object",
        required: ["decision"],
        properties: {
          decision: { type: "string", enum: ["approved", "rejected"] },
          rejectionReason: { type: "string", maxLength: 2000 },
        },
      },
      VerificationDecisionResponse: {
        type: "object",
        required: ["message", "request"],
        properties: {
          message: { type: "string", example: "Verification request approved" },
          request: { $ref: "#/components/schemas/VerificationRequest" },
        },
      },
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
    },
  },
} as const;

export const swaggerUiHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sola Properties API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout"
      });
    </script>
  </body>
</html>`;
