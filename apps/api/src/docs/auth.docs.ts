import { error, jsonBody, jsonResponse } from "./shared";

export const authPaths = {
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
} as const;

export const authSchemas = {
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
} as const;