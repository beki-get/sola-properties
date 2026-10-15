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
    title: "Sola Properties Authentication API",
    version: "1.0.0",
    description:
      "Authentication endpoints for registration, login, email verification, session renewal, and password recovery.",
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
  ],
  paths: {
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
