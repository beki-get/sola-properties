const errorResponse = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string" },
    code: { type: "string" },
    status: { type: "string" },
  },
  errors: {
    type: "object",
    additionalProperties: true,
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
    {
      name: "Properties",
      description: "Public property discovery and property-owner management",
    },
    {
      name: "Property Authorization",
      description:
        "Developer-agent authorization and authorized-property operations.",
    },
    {
      name: "Referrals",
      description: "Property inquiry and referral management.",
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

    "/api/v1/properties": {
      get: {
        tags: ["Properties"],
        summary: "List public properties",
        operationId: "listPublicProperties",
        parameters: [
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
          {
            name: "q",
            in: "query",
            description: "Search query",
            schema: { type: "string", maxLength: 200 },
          },
          {
            name: "location",
            in: "query",
            schema: { type: "string", maxLength: 300 },
          },
          {
            name: "property_types",
            in: "query",
            description: "Comma-separated property types",
            schema: { type: "string" },
          },
          {
            name: "features",
            in: "query",
            description: "Comma-separated property features",
            schema: { type: "string" },
          },
          {
            name: "price_min",
            in: "query",
            schema: { type: "number", minimum: 0 },
          },
          {
            name: "price_max",
            in: "query",
            schema: { type: "number", minimum: 0 },
          },
          {
            name: "min_size_sqm",
            in: "query",
            schema: { type: "number", exclusiveMinimum: 0 },
          },
          {
            name: "min_bedrooms",
            in: "query",
            schema: { type: "integer", minimum: 0 },
          },
          {
            name: "payment_plan",
            in: "query",
            schema: {
              type: "string",
              description: "Allowed payment preference from the API constants",
            },
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "newest",
                "price_asc",
                "price_desc",
                "location",
                "relevance",
              ],
              default: "newest",
            },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Public property results",
            "PublicPropertyListResponse",
          ),
          "400": error("Invalid property filters"),
          "500": error("Unexpected server error"),
        },
      },
      post: {
        tags: ["Properties"],
        summary: "Create a property",
        operationId: "createProperty",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("CreatePropertyRequest"),
        responses: {
          "201": jsonResponse(
            "Property created and submitted for approval",
            "PropertyResponse",
          ),
          "400": error("Invalid property data"),
          "401": error("Authentication is required"),
          "403": error("Only agents and developers can create properties"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/compare": {
      get: {
        tags: ["Properties"],
        summary: "Compare public properties",
        operationId: "compareProperties",
        parameters: [
          {
            name: "ids",
            in: "query",
            required: true,
            description: "Comma-separated UUIDs of 2–4 properties",
            schema: { type: "string", example: "uuid-1,uuid-2" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Properties to compare",
            "PropertyComparisonResponse",
          ),
          "400": error("Provide 2–4 unique, valid property IDs"),
          "404": error(
            "One or more properties were not found or are unavailable",
          ),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/recommended": {
      get: {
        tags: ["Properties"],
        summary: "Get recommended properties",
        operationId: "getRecommendedProperties",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse(
            "Recommended properties for the buyer",
            "RecommendedPropertiesResponse",
          ),
          "401": error("Authentication is required"),
          "403": error("An approved buyer account is required"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/me": {
      get: {
        tags: ["Properties"],
        summary: "List the authenticated owner's properties",
        operationId: "getMyProperties",
        security: [{ AccessToken: [] }],
        parameters: [
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
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "draft",
                "pending_approval",
                "active",
                "inactive",
                "sold",
                "rejected",
              ],
            },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Owner's property list",
            "MyPropertyListResponse",
          ),
          "400": error("Invalid property query"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/me/{propertyId}": {
      get: {
        tags: ["Properties"],
        summary: "Get one of the authenticated owner's properties",
        operationId: "getMyProperty",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse("Owner's property details", "PropertyResponse"),
          "400": error("Invalid property ID"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "404": error("Property not found"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/{propertyId}": {
      get: {
        tags: ["Properties"],
        summary: "Get public property details",
        operationId: "getPublicProperty",
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse("Public property details", "PropertyResponse"),
          "400": error("Invalid property ID"),
          "404": error("Property not found"),
          "500": error("Unexpected server error"),
        },
      },
      patch: {
        tags: ["Properties"],
        summary: "Update an owner's property",
        operationId: "updateProperty",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: jsonBody("UpdatePropertyRequest"),
        responses: {
          "200": jsonResponse("Property updated", "PropertyResponse"),
          "400": error("Invalid property ID or update data"),
          "401": error("Authentication is required"),
          "403": error("Role or project association is not allowed"),
          "404": error("Property or project not found"),
          "409": error("Property is not editable"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/{propertyId}/status": {
      patch: {
        tags: ["Properties"],
        summary: "Change an owner's property status",
        operationId: "updatePropertyStatus",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: jsonBody("UpdatePropertyStatusRequest"),
        responses: {
          "200": jsonResponse("Property status updated", "PropertyResponse"),
          "400": error("Invalid property ID or status"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "404": error("Property not found"),
          "409": error("Invalid property status transition"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/{propertyId}/images": {
      post: {
        tags: ["Properties"],
        summary: "Upload property images",
        operationId: "uploadPropertyImages",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                $ref: "#/components/schemas/UploadPropertyImagesRequest",
              },
            },
          },
        },
        responses: {
          "201": jsonResponse("Images uploaded", "PropertyImagesResponse"),
          "400": error("Invalid property ID or no images supplied"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "404": error("Property not found"),
          "409": error("Images are locked or the image limit was reached"),
          "500": error("Unexpected server error"),
        },
      },
      get: {
        tags: ["Properties"],
        summary: "List images for an owner's property",
        operationId: "getPropertyImages",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Property images with signed URLs",
            "PropertyImagesResponse",
          ),
          "400": error("Invalid property ID"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "404": error("Property not found"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/{propertyId}/images/{imageId}": {
      delete: {
        tags: ["Properties"],
        summary: "Delete an image from an owner's property",
        operationId: "deletePropertyImage",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "imageId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Image deleted; cleanup status returned",
            "DeletePropertyImageResponse",
          ),
          "400": error("Invalid property ID or image ID"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "404": error("Property or image not found"),
          "409": error("Images cannot be changed for this property's status"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/properties/{propertyId}/history": {
      get: {
        tags: ["Properties"],
        summary: "Get an owner's property history",
        operationId: "getMyPropertyHistory",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Property audit history",
            "PropertyHistoryResponse",
          ),
          "400": error("Invalid property ID"),
          "401": error("Authentication is required"),
          "403": error("An approved agent or developer account is required"),
          "404": error("Property not found"),
          "500": error("Unexpected server error"),
        },
      },
    },
    "/api/v1/developer/agents": {
      get: {
        tags: ["Property Authorization"],
        summary: "List approved agents",
        description:
          "Returns approved, email-verified agents. Developers can search by agent name or agency and paginate results.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 100 },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Approved agents retrieved successfully.",
            "ApprovedAgentsResponse",
          ),
          "400": error("Invalid query parameters."),
          "401": error("Authentication required."),
          "403": error("Developer role or approved account required."),
          "500": error("Internal server error."),
        },
      },
    },

    "/api/v1/developer/agents/{agentId}": {
      get: {
        tags: ["Property Authorization"],
        summary: "Get approved agent details",
        description: "Returns details for an approved, email-verified agent.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Agent details retrieved successfully.",
            "ApprovedAgentResponse",
          ),
          "400": error("Invalid agent ID."),
          "401": error("Authentication required."),
          "403": error("Developer role or approved account required."),
          "404": error("Approved agent not found."),
          "500": error("Internal server error."),
        },
      },
    },

    "/api/v1/developer/properties/{propertyId}/agents": {
      post: {
        tags: ["Property Authorization"],
        summary: "Authorize an agent for a property",
        description:
          "Authorizes an approved, email-verified agent to market an active property owned by the authenticated developer. A previously revoked authorization can be reactivated.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: jsonBody("AuthorizeAgentRequest"),
        responses: {
          "200": jsonResponse(
            "Agent authorization created or reactivated.",
            "PropertyAuthorizationResponse",
          ),
          "400": error("Invalid IDs or self-authorization attempted."),
          "401": error("Authentication required."),
          "403": error("Developer role or approved account required."),
          "404": error("Property or approved agent not found."),
          "409": error(
            "Property is not active or agent is already authorized.",
          ),
          "500": error("Internal server error."),
        },
      },
      get: {
        tags: ["Property Authorization"],
        summary: "List agents authorized for a property",
        description:
          "Returns agents authorized for a property owned by the authenticated developer. Results can be filtered by authorization status and searched by agent name or agency.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 100 },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["active", "revoked"] },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Authorized agents retrieved successfully.",
            "AuthorizedAgentsResponse",
          ),
          "400": error("Invalid path or query parameters."),
          "401": error("Authentication required."),
          "403": error("Developer role or approved account required."),
          "404": error("Property not found."),
          "500": error("Internal server error."),
        },
      },
    },

    "/api/v1/developer/properties/{propertyId}/agents/{agentId}": {
      patch: {
        tags: ["Property Authorization"],
        summary: "Revoke an agent's property authorization",
        description:
          "Revokes an existing authorization for a property owned by the authenticated developer.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Authorization revoked successfully.",
            "PropertyAuthorizationResponse",
          ),
          "400": error("Invalid path parameters."),
          "401": error("Authentication required."),
          "403": error("Developer role or approved account required."),
          "404": error("Property or authorization not found."),
          "409": error("Authorization has already been revoked."),
          "500": error("Internal server error."),
        },
      },
    },

    "/api/v1/agent/authorized-properties": {
      get: {
        tags: ["Property Authorization"],
        summary: "List properties authorized for the agent",
        description:
          "Returns active properties for which the authenticated agent has an active authorization. Supports pagination, text search, location filtering, and property-type filtering.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 100 },
          },
          {
            name: "location",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 200 },
          },
          {
            name: "property_type",
            in: "query",
            required: false,
            schema: { type: "string", maxLength: 100 },
          },
        ],
        responses: {
          "200": jsonResponse(
            "Authorized properties retrieved successfully.",
            "AgentAuthorizedPropertiesResponse",
          ),
          "400": error("Invalid query parameters."),
          "401": error("Authentication required."),
          "403": error("Agent role or approved account required."),
          "500": error("Internal server error."),
        },
      },
    },

    "/api/v1/admin/properties": {
      get: {
        tags: ["Properties"],
        summary: "List pending properties for admin review",
        description:
          "Returns pending_approval properties ordered by creation time, oldest first. Requires the admin role.",
        security: [{ AccessToken: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
            description: "Page number.",
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
            description: "Number of properties per page.",
          },
        ],
        responses: {
          "200": {
            description: "Pending properties retrieved successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["items", "page", "limit", "total"],
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Property" },
                    },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer", minimum: 0 },
                  },
                },
              },
            },
          },
          "400": error("Invalid pagination parameters."),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error("The authenticated user does not have the admin role."),
        },
      },
    },

    "/api/v1/admin/properties/{propertyId}": {
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID of the pending property.",
        },
      ],
      get: {
        tags: ["Properties"],
        summary: "Get a pending property for admin review",
        description:
          "Returns a single property only if its status is pending_approval. Requires the admin role.",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse(
            "Pending property retrieved successfully.",
            "AdminPendingPropertyResponse",
          ),
          "400": error(
            "Invalid property ID (INVALID_PROPERTY_ID), or invalid request data.",
          ),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error("The authenticated user does not have the admin role."),
          "404": error(
            "Pending property not found (PENDING_PROPERTY_NOT_FOUND).",
          ),
        },
      },
    },

    "/api/v1/admin/properties/{propertyId}/decision": {
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID of the property to review.",
        },
      ],
      patch: {
        tags: ["Properties"],
        summary: "Approve or reject a property",
        description:
          "Approves a pending property by setting its status to active, or rejects it by setting its status to rejected. Rejection requires a reason. The decision and audit record are saved in a transaction. Requires the admin role.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("AdminPropertyDecisionRequest"),
        responses: {
          "200": jsonResponse(
            "Property status applied successfully.",
            "AdminPendingPropertyResponse",
          ),
          "400": error(
            "Invalid property ID (INVALID_PROPERTY_ID), invalid decision body (VALIDATION_ERROR).",
          ),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error("The authenticated user does not have the admin role."),
          "404": error("Property not found (PROPERTY_NOT_FOUND)."),
          "409": error(
            "Only pending properties can be approved or rejected (PROPERTY_NOT_PENDING).",
          ),
        },
      },
    },

    "/api/v1/referrals": {
      post: {
        tags: ["Referrals"],
        summary: "Create a property referral",
        description:
          "Allows an authenticated, approved, email-verified buyer to submit an inquiry for an active property. Agent-owned properties are assigned to their owner. Developer-owned properties are assigned to the earliest eligible authorized agent, if one exists; otherwise, they are assigned to the developer. A buyer cannot have more than one open referral for the same property.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("CreateReferralRequest"),
        responses: {
          "201": jsonResponse(
            "Referral created successfully.",
            "CreateReferralResponse",
          ),
          "400": error("Invalid request body (INVALID_REFERRAL_INPUT)."),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error(
            "The buyer account is not eligible (BUYER_NOT_ELIGIBLE).",
          ),
          "404": error("Property not found (PROPERTY_NOT_FOUND)."),
          "409": error(
            "The property is not active (PROPERTY_NOT_ACTIVE), the owner is ineligible (PROPERTY_OWNER_NOT_ELIGIBLE), or an open referral already exists (DUPLICATE_ACTIVE_REFERRAL).",
          ),
          "500": error(
            "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
          ),
        },
      },
    },

    "/api/v1/referrals/me": {
      get: {
        tags: ["Referrals"],
        summary: "Get referrals assigned to the current agent or developer",
        description:
          "Returns referrals assigned to the authenticated agent or developer, ordered by assignment time and creation time, newest first. Only agent and developer roles can access this endpoint.",
        security: [{ AccessToken: [] }],
        responses: {
          "200": jsonResponse(
            "Assigned referrals retrieved successfully.",
            "MyReferralsResponse",
          ),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error(
            "Email verification, an approved active account, or an allowed role is required.",
          ),
          "500": error("An unexpected server error occurred."),
        },
      },
    },

    "/api/v1/referrals/{referralId}/decision": {
      parameters: [
        {
          name: "referralId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Unique ID of the referral to accept or reject.",
        },
      ],
      patch: {
        tags: ["Referrals"],
        summary: "Accept or reject an assigned referral",
        operationId: "respondToReferral",
        description:
          "Only the agent or developer currently assigned to the referral can respond. Only assigned referrals can be accepted or rejected. Rejection requires a reason.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("ReferralDecisionRequest"),
        responses: {
          "200": jsonResponse(
            "Referral decision recorded successfully.",
            "ReferralMutationResponse",
          ),
          "400": error(
            "Invalid decision input (INVALID_REFERRAL_DECISION), or a rejection reason is required (REJECTION_REASON_REQUIRED).",
          ),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error(
            "The role is not allowed (ROLE_NOT_ALLOWED), or the referral is not assigned to the current user (REFERRAL_NOT_ASSIGNED).",
          ),
          "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
          "409": error(
            "Only assigned referrals can be accepted or rejected (INVALID_REFERRAL_TRANSITION).",
          ),
          "500": error("An unexpected server error occurred."),
        },
      },
    },

    "/api/v1/referrals/{referralId}/status": {
      parameters: [
        {
          name: "referralId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Unique ID of the referral to update.",
        },
      ],
      patch: {
        tags: ["Referrals"],
        summary: "Update an assigned referral's status",
        operationId: "updateReferralStatus",
        description:
          "Only the agent or developer assigned to the referral can update its status. Allowed transitions are accepted -> in_progress or closed_lost; in_progress -> agreement or closed_lost; and agreement -> closed_won or closed_lost. Marking a referral as closed_lost requires a reason.",
        security: [{ AccessToken: [] }],
        requestBody: jsonBody("ReferralStatusRequest"),
        responses: {
          "200": jsonResponse(
            "Referral status updated successfully.",
            "ReferralMutationResponse",
          ),
          "400": error(
            "Invalid status input (INVALID_REFERRAL_STATUS), or a reason is required when marking the referral as lost (STATUS_REASON_REQUIRED).",
          ),
          "401": error(
            "Authentication is required or the access token is invalid.",
          ),
          "403": error(
            "The role is not allowed (ROLE_NOT_ALLOWED), or the referral is not assigned to the current user (REFERRAL_NOT_ASSIGNED).",
          ),
          "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
          "409": error(
            "The requested status transition is not allowed (INVALID_REFERRAL_TRANSITION).",
          ),
          "500": error("An unexpected server error occurred."),
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

      Property: {
        type: "object",
        required: [
          "id",
          "owner_id",
          "title",
          "property_type",
          "location",
          "features",
          "status",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          owner_id: { type: "string", format: "uuid" },
          project_id: { type: "string", format: "uuid", nullable: true },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          property_type: { type: "string" },
          location: { type: "string" },
          size_sqm: { type: "number", nullable: true },
          bedrooms: { type: "integer", nullable: true },
          bathrooms: { type: "integer", nullable: true },
          features: { type: "array", items: { type: "string" } },
          price: { type: "number", nullable: true },
          payment_plan: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: [
              "draft",
              "pending_approval",
              "active",
              "inactive",
              "sold",
              "rejected",
            ],
          },
          rejection_reason: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      PropertyResponse: {
        type: "object",
        required: ["property"],
        properties: {
          property: { $ref: "#/components/schemas/Property" },
        },
      },
      CreatePropertyRequest: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "property_type",
          "location",
          "price",
          "payment_plan",
        ],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 10000, nullable: true },
          property_type: {
            type: "string",
            description: "A value accepted by PROPERTY_TYPES",
          },
          location: { type: "string", minLength: 1, maxLength: 300 },
          size_sqm: { type: "number", exclusiveMinimum: 0, nullable: true },
          bedrooms: { type: "integer", minimum: 0, nullable: true },
          bathrooms: { type: "integer", minimum: 0, nullable: true },
          features: { type: "array", maxItems: 20, items: { type: "string" } },
          price: { type: "number", exclusiveMinimum: 0 },
          payment_plan: {
            type: "string",
            description: "A value accepted by PAYMENT_PREFERENCES",
          },
          project_id: { type: "string", format: "uuid", nullable: true },
        },
      },
      UpdatePropertyRequest: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 10000, nullable: true },
          property_type: {
            type: "string",
            description: "A value accepted by PROPERTY_TYPES",
          },
          location: { type: "string", minLength: 1, maxLength: 300 },
          size_sqm: { type: "number", exclusiveMinimum: 0, nullable: true },
          bedrooms: { type: "integer", minimum: 0, nullable: true },
          bathrooms: { type: "integer", minimum: 0, nullable: true },
          features: { type: "array", maxItems: 20, items: { type: "string" } },
          price: { type: "number", exclusiveMinimum: 0 },
          payment_plan: {
            type: "string",
            description: "A value accepted by PAYMENT_PREFERENCES",
          },
          project_id: { type: "string", format: "uuid", nullable: true },
        },
      },
      UpdatePropertyStatusRequest: {
        type: "object",
        additionalProperties: false,
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["inactive", "sold"] },
        },
      },
      MyPropertyListResponse: {
        type: "object",
        required: ["items", "page", "limit", "total"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Property" },
          },
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
        },
      },
      PublicPropertyListResponse: {
        type: "object",
        required: ["items", "page", "limit", "total"],
        properties: {
          items: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/Property" },
                {
                  type: "object",
                  properties: {
                    possible_duplicate: { type: "boolean" },
                    possible_duplicate_count: { type: "integer" },
                  },
                },
              ],
            },
          },
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
        },
      },
      PropertyComparisonResponse: {
        type: "object",
        required: ["properties"],
        properties: {
          properties: {
            type: "array",
            items: { $ref: "#/components/schemas/Property" },
          },
        },
      },
      RecommendedPropertiesResponse: {
        type: "object",
        required: ["properties"],
        properties: {
          properties: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/Property" },
                {
                  type: "object",
                  properties: {
                    match_score: { type: "number" },
                  },
                },
              ],
            },
          },
        },
      },
      UploadPropertyImagesRequest: {
        type: "object",
        required: ["images"],
        properties: {
          images: {
            type: "array",
            maxItems: 10,
            items: { type: "string", format: "binary" },
            description: "JPEG, PNG, or WebP image files",
          },
        },
      },
      PropertyImage: {
        type: "object",
        required: [
          "id",
          "property_id",
          "original_filename",
          "mime_type",
          "file_size",
          "is_primary",
          "display_order",
          "created_at",
          "url",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          property_id: { type: "string", format: "uuid" },
          original_filename: { type: "string" },
          mime_type: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp"],
          },
          file_size: { type: "integer" },
          is_primary: { type: "boolean" },
          display_order: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          url: {
            type: "string",
            format: "uri",
            description: "Signed image URL",
          },
        },
      },
      PropertyImagesResponse: {
        type: "object",
        required: ["images"],
        properties: {
          images: {
            type: "array",
            items: { $ref: "#/components/schemas/PropertyImage" },
          },
        },
      },
      DeletePropertyImageResponse: {
        type: "object",
        required: ["deleted", "cleanupPending"],
        properties: {
          deleted: { type: "boolean", enum: [true] },
          cleanupPending: { type: "boolean" },
        },
      },
      PropertyHistoryResponse: {
        type: "object",
        required: ["message", "data"],
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                actor_id: { type: "string", format: "uuid", nullable: true },
                action: { type: "string" },
                old_values: {
                  type: "object",
                  nullable: true,
                  additionalProperties: true,
                },
                new_values: {
                  type: "object",
                  nullable: true,
                  additionalProperties: true,
                },
                created_at: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      AuthorizeAgentRequest: {
        type: "object",
        required: ["agentId"],
        properties: {
          agentId: {
            type: "string",
            format: "uuid",
            description: "ID of the approved agent to authorize.",
          },
        },
      },

      PropertyAuthorization: {
        type: "object",
        required: [
          "id",
          "property_id",
          "agent_id",
          "authorized_by",
          "status",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          property_id: { type: "string", format: "uuid" },
          agent_id: { type: "string", format: "uuid" },
          authorized_by: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["active", "revoked"] },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },

      PropertyAuthorizationResponse: {
        type: "object",
        required: ["message", "authorization"],
        properties: {
          message: { type: "string" },
          authorization: {
            $ref: "#/components/schemas/PropertyAuthorization",
          },
        },
      },

      AgentSummary: {
        type: "object",
        required: ["id", "full_name", "status", "agency_name"],
        properties: {
          id: { type: "string", format: "uuid" },
          full_name: { type: "string" },
          status: { type: "string" },
          agency_name: { type: "string", nullable: true },
          bio: { type: "string", nullable: true },
          years_of_experience: { type: "integer", nullable: true },
          authorization_status: {
            type: "string",
            enum: ["active", "revoked"],
          },
          authorized_at: { type: "string", format: "date-time" },
        },
      },

      Pagination: {
        type: "object",
        required: ["page", "limit", "total"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
        },
      },

      ApprovedAgentsResponse: {
        type: "object",
        required: ["items", "pagination"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/AgentSummary" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },

      ApprovedAgentResponse: {
        type: "object",
        required: ["agent"],
        properties: {
          agent: { $ref: "#/components/schemas/AgentSummary" },
        },
      },

      AuthorizedAgentsResponse: {
        type: "object",
        required: ["items", "pagination"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/AgentSummary" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },

      AuthorizedProperty: {
        type: "object",
        required: [
          "id",
          "title",
          "description",
          "property_type",
          "location",
          "size_sqm",
          "bedrooms",
          "bathrooms",
          "price",
          "payment_plan",
          "status",
          "project_id",
          "authorized_at",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          property_type: { type: "string" },
          location: { type: "string" },
          size_sqm: { type: "number", nullable: true },
          bedrooms: { type: "integer", nullable: true },
          bathrooms: { type: "integer", nullable: true },
          price: { type: "number", nullable: true },
          payment_plan: { type: "string", nullable: true },
          status: { type: "string" },
          project_id: { type: "string", format: "uuid", nullable: true },
          authorized_at: { type: "string", format: "date-time" },
        },
      },

      AgentAuthorizedPropertiesResponse: {
        type: "object",
        required: ["items", "pagination"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/AuthorizedProperty" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },

      AdminPendingPropertyResponse: {
        type: "object",
        required: ["property"],
        properties: {
          property: {
            $ref: "#/components/schemas/Property",
          },
        },
      },

      AdminPropertyDecisionRequest: {
        type: "object",
        additionalProperties: false,
        required: ["decision"],
        properties: {
          decision: {
            type: "string",
            enum: ["approve", "reject"],
            description: "Decision to apply to the pending property.",
          },
          rejection_reason: {
            type: "string",
            minLength: 1,
            maxLength: 2000,
            description:
              "Required when decision is reject. Leading and trailing whitespace is trimmed before validation.",
          },
        },
        description:
          "When decision is reject, rejection_reason must be provided and must contain at least one non-whitespace character.",
      },

      CreateReferralRequest: {
        type: "object",
        required: ["propertyId"],
        properties: {
          propertyId: {
            type: "string",
            format: "uuid",
            description: "ID of the property being inquired about.",
          },
          message: {
            type: "string",
            minLength: 1,
            maxLength: 2000,
            description:
              "Optional inquiry message. Leading and trailing whitespace is trimmed.",
          },
        },
      },

      CreateReferralResponse: {
        type: "object",
        required: ["message", "referral"],
        properties: {
          message: {
            type: "string",
            example: "Inquiry submitted successfully.",
          },
          referral: {
            type: "object",
            required: [
              "id",
              "reference_code",
              "buyer_id",
              "property_id",
              "assigned_to",
              "message",
              "status",
              "status_reason",
              "assigned_at",
              "accepted_at",
              "created_at",
              "updated_at",
            ],
            properties: {
              id: { type: "string", format: "uuid" },
              reference_code: { type: "string" },
              buyer_id: { type: "string", format: "uuid" },
              property_id: { type: "string", format: "uuid" },
              assigned_to: { type: "string", format: "uuid" },
              message: {
                type: "string",
                nullable: true,
              },
              status: {
                type: "string",
                example: "assigned",
              },
              status_reason: {
                type: "string",
                nullable: true,
              },
              assigned_at: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
              accepted_at: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
              created_at: {
                type: "string",
                format: "date-time",
              },
              updated_at: {
                type: "string",
                format: "date-time",
              },
            },
          },
        },
      },
      MyReferralsResponse: {
        type: "object",
        required: ["referrals"],
        properties: {
          referrals: {
            type: "array",
            items: {
              type: "object",
              required: [
                "id",
                "reference_code",
                "buyer_id",
                "buyer_name",
                "property_id",
                "property_title",
                "message",
                "status",
                "status_reason",
                "assigned_at",
                "accepted_at",
                "created_at",
                "updated_at",
              ],
              properties: {
                id: { type: "string" },
                reference_code: { type: "string" },
                buyer_id: { type: "string" },
                buyer_name: { type: "string" },
                property_id: { type: "string" },
                property_title: { type: "string" },
                message: { type: "string", nullable: true },
                status: { type: "string" },
                status_reason: { type: "string", nullable: true },
                assigned_at: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                },
                accepted_at: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                },
                created_at: { type: "string", format: "date-time" },
                updated_at: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },

      ReferralMutationResponse: {
        type: "object",
        required: ["referral"],
        properties: {
          referral: {
            type: "object",
            required: [
              "id",
              "reference_code",
              "buyer_id",
              "property_id",
              "assigned_to",
              "message",
              "status",
              "status_reason",
              "assigned_at",
              "accepted_at",
              "created_at",
              "updated_at",
            ],
            properties: {
              id: { type: "string" },
              reference_code: { type: "string" },
              buyer_id: { type: "string" },
              property_id: { type: "string" },
              assigned_to: { type: "string" },
              message: { type: "string", nullable: true },
              status: { type: "string" },
              status_reason: { type: "string", nullable: true },
              assigned_at: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
              accepted_at: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
      ReferralDecisionRequest: {
        type: "object",
        required: ["decision"],
        properties: {
          decision: {
            type: "string",
            enum: ["accepted", "rejected"],
          },
          reason: {
            type: "string",
            minLength: 1,
            maxLength: 1000,
            description: "Required when decision is rejected.",
          },
        },
        example: {
          decision: "accepted",
        },
      },

      ReferralStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["in_progress", "agreement", "closed_won", "closed_lost"],
          },
          reason: {
            type: "string",
            minLength: 1,
            maxLength: 1000,
            description: "Required when status is closed_lost.",
          },
        },
        example: {
          status: "in_progress",
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
