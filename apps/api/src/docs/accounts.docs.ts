import { error, jsonBody, jsonResponse } from "./shared";

export const accountPaths = {
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
        "Requires an authenticated buyer. Omitted values reset to their defaults. category_ids and location_ids must contain active UUIDs. budget_min must not exceed budget_max.",
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
        "Requires an authenticated buyer. Omitted values remain unchanged; supplied category_ids and location_ids replace the corresponding lists. Both ID lists must contain active UUIDs. budget_min must not exceed budget_max.",
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
} as const;

export const accountSchemas = {
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
      category_ids: {
        type: "array",
        maxItems: 50,
        uniqueItems: true,
        items: { type: "string", format: "uuid" },
        nullable: true,
      },
      location_ids: {
        type: "array",
        maxItems: 50,
        uniqueItems: true,
        items: { type: "string", format: "uuid" },
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
      category_ids: {
        type: "array",
        items: { type: "string", format: "uuid" },
      },
      location_ids: {
        type: "array",
        items: { type: "string", format: "uuid" },
      },
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
} as const;