
import { error, jsonBody, jsonResponse } from "./shared";

export const referralIssuePaths = {
  "/api/v1/referral-issues": {
    post: {
      tags: ["Referral Issues"],
      summary: "Report an issue with a referral",
      operationId: "createReferralIssue",
      description:
        "Allows the buyer who created a referral or the agent/developer assigned to it to submit an issue report. The reporter role and user ID are taken from the authenticated account.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateReferralIssueRequest"),
      responses: {
        "201": jsonResponse(
          "Referral issue reported successfully.",
          "ReferralIssueMutationResponse",
        ),
        "400": error("Invalid report data (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error(
          "The user's role is not allowed (ROLE_NOT_ALLOWED), or the user does not have access to the referral (REFERRAL_ACCESS_DENIED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referral-issues/me": {
    get: {
      tags: ["Referral Issues"],
      summary: "Get the current user's referral issue reports",
      operationId: "getMyReferralIssues",
      description:
        "Returns issue reports submitted by the authenticated buyer, agent, or developer, ordered from newest to oldest. Results are paginated.",
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
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Your referral issue reports retrieved successfully.",
          "MyReferralIssuesResponse",
        ),
        "400": error("Invalid pagination parameters (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved buyer, agent, or developer account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referral-issues/admin": {
    get: {
      tags: ["Referral Issues"],
      summary: "List referral issue reports as an administrator",
      operationId: "getAdminReferralIssues",
      description:
        "Returns all referral issue reports, ordered from newest to oldest. Administrators can optionally filter by issue status. Results are paginated.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "status",
          in: "query",
          required: false,
          description: "Filter reports by their issue-report status.",
          schema: {
            type: "string",
            enum: ["open", "under_review", "resolved", "dismissed"],
          },
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
      ],
      responses: {
        "200": jsonResponse(
          "Referral issue reports retrieved successfully.",
          "AdminReferralIssuesResponse",
        ),
        "400": error(
          "Invalid pagination parameters (VALIDATION_ERROR) or issue status (INVALID_ISSUE_STATUS).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referral-issues/admin/{issueId}": {
    parameters: [
      {
        name: "issueId",
        in: "path",
        required: true,
        description: "Unique ID of the referral issue report.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      tags: ["Referral Issues"],
      summary: "Get a referral issue report as an administrator",
      operationId: "getAdminReferralIssueById",
      description:
        "Returns a referral issue report with reporter, buyer, assigned seller, referral, and property details.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Referral issue report retrieved successfully.",
          "AdminReferralIssueResponse",
        ),
        "400": error("Invalid report ID (VALIDATION_ERROR)."),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "404": error("Referral issue report not found (REFERRAL_ISSUE_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
    patch: {
      tags: ["Referral Issues"],
      summary: "Update a referral issue report",
      operationId: "updateReferralIssue",
      description:
        "Allows an administrator to update the issue status, admin notes, and resolution. A report can move from open to under_review, resolved, or dismissed; from under_review to resolved or dismissed. Resolved and dismissed reports cannot be transitioned further. A resolution is required when the resulting status is resolved.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("UpdateReferralIssueRequest"),
      responses: {
        "200": jsonResponse(
          "Referral issue report updated successfully.",
          "ReferralIssueMutationResponse",
        ),
        "400": error(
          "Invalid report ID or update data (VALIDATION_ERROR), invalid status transition (INVALID_ISSUE_STATUS_TRANSITION), or a resolution is required (RESOLUTION_REQUIRED).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("An approved admin account is required."),
        "404": error("Referral issue report not found (REFERRAL_ISSUE_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },
} as const;

export const referralIssueSchemas = {
  CreateReferralIssueRequest: {
    type: "object",
    required: ["referralId", "category", "subject", "description"],
    properties: {
      referralId: { type: "string", format: "uuid" },
      category: {
        type: "string",
        enum: [
          "communication",
          "property_information",
          "seller_behavior",
          "buyer_behavior",
          "payment",
          "visit_or_scheduling",
          "fraud_or_suspicious_activity",
          "other",
        ],
      },
      subject: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", minLength: 1, maxLength: 5000 },
    },
    example: {
      referralId: "550e8400-e29b-41d4-a716-446655440000",
      category: "communication",
      subject: "No response after multiple follow-ups",
      description: "I have tried contacting the assigned seller several times without receiving a response.",
    },
  },

  UpdateReferralIssueRequest: {
    type: "object",
    minProperties: 1,
    properties: {
      status: {
        type: "string",
        enum: ["open", "under_review", "resolved", "dismissed"],
      },
      adminNotes: {
        type: "string",
        maxLength: 5000,
        nullable: true,
        description: "Optional internal admin notes. Send null to clear existing notes.",
      },
      resolution: {
        type: "string",
        maxLength: 5000,
        nullable: true,
        description: "Resolution details. Required when the resulting status is resolved. Send null to clear the existing resolution when permitted.",
      },
    },
    example: {
      status: "resolved",
      adminNotes: "The assigned seller was contacted.",
      resolution: "The seller contacted the buyer and provided the requested information.",
    },
  },

  ReferralIssueRecord: {
    type: "object",
    required: [
      "id",
      "referral_id",
      "reported_by",
      "category",
      "subject",
      "description",
      "status",
      "admin_notes",
      "resolution",
      "reviewed_by",
      "reviewed_at",
      "resolved_at",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      referral_id: { type: "string", format: "uuid" },
      reported_by: { type: "string", format: "uuid" },
      category: {
        type: "string",
        enum: [
          "communication",
          "property_information",
          "seller_behavior",
          "buyer_behavior",
          "payment",
          "visit_or_scheduling",
          "fraud_or_suspicious_activity",
          "other",
        ],
      },
      subject: { type: "string" },
      description: { type: "string" },
      status: {
        type: "string",
        enum: ["open", "under_review", "resolved", "dismissed"],
      },
      admin_notes: { type: "string", nullable: true },
      resolution: { type: "string", nullable: true },
      reviewed_by: { type: "string", format: "uuid", nullable: true },
      reviewed_at: { type: "string", format: "date-time", nullable: true },
      resolved_at: { type: "string", format: "date-time", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },

  ReferralIssueMutationResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: { $ref: "#/components/schemas/ReferralIssueRecord" },
    },
  },

  MyReferralIssuesResponse: {
    type: "object",
    required: ["message", "data", "pagination"],
    properties: {
      message: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          required: [
            "id",
            "referral_id",
            "category",
            "subject",
            "description",
            "status",
            "created_at",
            "reference_code",
            "property_title",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            referral_id: { type: "string", format: "uuid" },
            category: {
              type: "string",
              enum: [
                "communication",
                "property_information",
                "seller_behavior",
                "buyer_behavior",
                "payment",
                "visit_or_scheduling",
                "fraud_or_suspicious_activity",
                "other",
              ],
            },
            subject: { type: "string" },
            description: { type: "string" },
            status: {
              type: "string",
              enum: ["open", "under_review", "resolved", "dismissed"],
            },
            created_at: { type: "string", format: "date-time" },
            reference_code: { type: "string" },
            property_title: { type: "string" },
          },
        },
      },
      pagination: {
        $ref: "#/components/schemas/ReferralIssuePagination",
      },
    },
  },

  AdminReferralIssuesResponse: {
    type: "object",
    required: ["message", "data", "pagination"],
    properties: {
      message: { type: "string" },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/AdminReferralIssue",
        },
      },
      pagination: {
        $ref: "#/components/schemas/ReferralIssuePagination",
      },
    },
  },

  AdminReferralIssueResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/AdminReferralIssue",
      },
    },
  },

  AdminReferralIssue: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      referral_id: { type: "string", format: "uuid" },
      reported_by: { type: "string", format: "uuid" },
      category: {
        type: "string",
        enum: [
          "communication",
          "property_information",
          "seller_behavior",
          "buyer_behavior",
          "payment",
          "visit_or_scheduling",
          "fraud_or_suspicious_activity",
          "other",
        ],
      },
      subject: { type: "string" },
      description: { type: "string" },
      status: {
        type: "string",
        enum: ["open", "under_review", "resolved", "dismissed"],
      },
      admin_notes: { type: "string", nullable: true },
      resolution: { type: "string", nullable: true },
      reviewed_by: { type: "string", format: "uuid", nullable: true },
      reviewed_at: { type: "string", format: "date-time", nullable: true },
      resolved_at: { type: "string", format: "date-time", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },

      reference_code: { type: "string" },
      referral_status: { type: "string" },

      property_id: { type: "string", format: "uuid" },
      property_title: { type: "string" },
      property_location: { type: "string", nullable: true },
      property_status: { type: "string" },

      reporter_name: { type: "string" },
      reporter_email: { type: "string", format: "email" },
      reporter_role: {
        type: "string",
        enum: ["buyer", "agent", "developer"],
      },
      reporter_phone: { type: "string", nullable: true },

      buyer_id: { type: "string", format: "uuid" },
      buyer_name: { type: "string" },
      buyer_email: { type: "string", format: "email" },

      assigned_seller_id: { type: "string", format: "uuid" },
      assigned_seller_name: { type: "string" },
      assigned_seller_email: { type: "string", format: "email" },
      assigned_seller_role: {
        type: "string",
        enum: ["agent", "developer"],
      },
    },
  },

  ReferralIssuePagination: {
    type: "object",
    required: ["page", "limit", "total", "totalPages"],
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer", minimum: 0 },
      totalPages: { type: "integer", minimum: 0 },
    },
  },
} as const;
