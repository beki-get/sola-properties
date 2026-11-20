import { error, jsonBody, jsonResponse } from "./shared";

export const referralPaths = {
  "/api/v1/referrals": {
    post: {
      tags: ["Referrals"],
      summary: "Create a property referral when sending inquiry to seller",
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
        "403": error("The buyer account is not eligible (BUYER_NOT_ELIGIBLE)."),
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

  "/api/v1/referrals/buyer/me": {
    get: {
      tags: ["Referrals"],
      summary: "Get the current buyer's referrals",
      operationId: "getBuyerReferrals",
      description:
        "Returns referrals created by the authenticated buyer, including the assigned agent or developer and the current referral status. Requires an approved buyer account.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Buyer referrals retrieved successfully.",
          "BuyerReferralsResponse",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved buyer account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/me/export": {
    get: {
      tags: ["Referrals"],
      summary: "Export the current agent's or developer's referrals",
      operationId: "exportMyReferrals",
      description:
        "Downloads a CSV file containing referrals assigned to the authenticated agent or developer. Requires an approved account.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": {
          description: "CSV export generated successfully.",
          headers: {
            "Content-Disposition": {
              description: "Download filename.",
              schema: {
                type: "string",
                example: 'attachment; filename="sola-my-referrals.csv"',
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
        },
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved agent or developer account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/admin/export": {
    get: {
      tags: ["Referrals"],
      summary: "Export referrals as an administrator",
      operationId: "exportAllReferrals",
      description:
        "Downloads a CSV file of referrals matching the supplied administrative filters. Supports the same filters as the admin referral list.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "q",
          in: "query",
          required: false,
          description: "Search term. Maximum 100 characters.",
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: [
              "assigned",
              "accepted",
              "rejected",
              "in_progress",
              "agreement",
              "closed_won",
              "closed_lost",
            ],
          },
        },
        {
          name: "dateFrom",
          in: "query",
          required: false,
          description: "Start date, inclusive.",
          schema: { type: "string", format: "date" },
        },
        {
          name: "dateTo",
          in: "query",
          required: false,
          description: "End date, inclusive. Must be on or after dateFrom.",
          schema: { type: "string", format: "date" },
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
        "200": {
          description: "CSV export generated successfully.",
          headers: {
            "Content-Disposition": {
              schema: {
                type: "string",
                example: 'attachment; filename="sola-referrals.csv"',
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
        },
        "400": error(
          "Invalid referral filters (VALIDATION_ERROR), including an invalid date range.",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/admin": {
    get: {
      tags: ["Referrals"],
      summary: "List referrals as an administrator",
      operationId: "getAllReferrals",
      description:
        "Returns a paginated list of referrals. Administrators can filter by search term, status, and date range. dateFrom must not be later than dateTo.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "q",
          in: "query",
          required: false,
          description: "Search term. Maximum 100 characters.",
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: [
              "assigned",
              "accepted",
              "rejected",
              "in_progress",
              "agreement",
              "closed_won",
              "closed_lost",
            ],
          },
        },
        {
          name: "dateFrom",
          in: "query",
          required: false,
          schema: { type: "string", format: "date" },
        },
        {
          name: "dateTo",
          in: "query",
          required: false,
          schema: { type: "string", format: "date" },
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
          "Referrals retrieved successfully.",
          "AdminReferralsResponse",
        ),
        "400": error("Invalid referral filters (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved admin account is required."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/admin/{referralId}": {
    parameters: [
      {
        name: "referralId",
        in: "path",
        required: true,
        description: "Unique ID of the referral.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      tags: ["Referrals"],
      summary: "Get referral details as an administrator",
      operationId: "getReferralDetails",
      description:
        "Returns detailed referral information, including buyer and assigned-user contact details. Requires an approved admin account.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Referral details retrieved successfully.",
          "AdminReferralDetailsResponse",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved admin account is required."),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/admin/{referralId}/reassign": {
    parameters: [
      {
        name: "referralId",
        in: "path",
        required: true,
        description: "Unique ID of the referral to reassign.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: {
      tags: ["Referrals"],
      summary: "Reassign a referral",
      operationId: "reassignReferral",
      description:
        "Allows an administrator to assign a referral to another eligible agent or developer. An optional reason can be recorded with the reassignment.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("ReassignReferralRequest"),
      responses: {
        "200": jsonResponse(
          "Referral reassigned successfully.",
          "ReferralMutationResponse",
        ),
        "400": error(
          "Invalid reassignment input (INVALID REASSIGNMENT INPUT), the new assignee is invalid (INVALID_ASSIGNEE), or the referral is already assigned to that user (SAME_ASSIGNEE).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The assignee is not authorized (ASSIGNEE_NOT_AUTHORIZED), or an approved admin account is required.",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "409": error(
          "The referral cannot be reassigned (REFERRAL_NOT_REASSIGNABLE), or its property is not active (PROPERTY_NOT_ACTIVE).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/admin/{referralId}/history": {
    parameters: [
      {
        name: "referralId",
        in: "path",
        required: true,
        description: "Unique ID of the referral.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      tags: ["Referrals"],
      summary: "Get referral history",
      operationId: "getReferralHistory",
      description:
        "Returns the recorded events and assignment changes for a referral. Requires an approved admin account.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Referral history retrieved successfully.",
          "ReferralHistoryResponse",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved admin account is required."),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/{referralId}/follow-ups": {
    parameters: [
      {
        name: "referralId",
        in: "path",
        required: true,
        description: "Unique ID of the referral.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    post: {
      tags: ["Referrals"],
      summary: "Create a referral follow-up",
      operationId: "createReferralFollowUp",
      description:
        "Allows the agent or developer assigned to a referral to record a follow-up. Follow-ups can only be added while the referral is accepted, in progress, or in agreement.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateReferralFollowUpRequest"),
      responses: {
        "201": jsonResponse(
          "Follow-up recorded successfully.",
          "CreateReferralFollowUpResponse",
        ),
        "400": error(
          "Invalid referral ID (INVALID_REFERRAL_ID) or invalid follow-up data.",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The referral is not assigned to the current user (REFERRAL_NOT_ASSIGNED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "409": error(
          "The referral is not open for follow-ups (REFERRAL_NOT_OPEN).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
    get: {
      tags: ["Referrals"],
      summary: "List referral follow-ups",
      operationId: "getReferralFollowUps",
      description:
        "Returns paginated follow-ups for a referral. Agents and developers can access their assigned referrals; administrators can access referrals for review.",
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
          "Referral follow-ups retrieved successfully.",
          "ReferralFollowUpsResponse",
        ),
        "400": error("Invalid referral ID or pagination parameters."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The referral is not assigned to the current user (REFERRAL_NOT_ASSIGNED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/referrals/{referralId}/messages": {
    parameters: [
      {
        name: "referralId",
        in: "path",
        required: true,
        description: "Unique ID of the referral.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    post: {
      tags: ["Referrals"],
      summary: "Send a referral message",
      operationId: "createReferralMessage",
      description:
        "Allows the buyer who created the referral or the agent/developer assigned to it to send a message. Messages can only be sent while the referral is assigned, accepted, in progress, or in agreement.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateReferralMessageRequest"),
      responses: {
        "201": jsonResponse(
          "Message sent successfully.",
          "CreateReferralMessageResponse",
        ),
        "400": error(
          "Invalid referral ID (INVALID_REFERRAL_ID) or invalid message data.",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to the referral (REFERRAL_ACCESS_DENIED or REFERRAL_NOT_ASSIGNED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "409": error(
          "The referral is not open for messaging (REFERRAL_NOT_OPEN).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
    get: {
      tags: ["Referrals"],
      summary: "Get referral messages",
      operationId: "getReferralMessages",
      description:
        "Returns paginated messages for a referral. The buyer and assigned agent/developer can access their referral messages; administrators can also view them.",
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
          "Referral messages retrieved successfully.",
          "ReferralMessagesResponse",
        ),
        "400": error("Invalid referral ID or pagination parameters."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to the referral (REFERRAL_ACCESS_DENIED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },
} as const;

export const referralSchemas = {
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

  BuyerReferralsResponse: {
    type: "object",
    required: ["referrals"],
    properties: {
      referrals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            reference_code: { type: "string" },
            property_id: { type: "string", format: "uuid" },
            property_title: { type: "string" },
            assigned_to: { type: "string", format: "uuid", nullable: true },
            assignee_name: { type: "string", nullable: true },
            assignee_role: {
              type: "string",
              enum: ["agent", "developer"],
              nullable: true,
            },
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

  AdminReferralsResponse: {
    type: "object",
    required: ["items", "page", "limit", "total"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            reference_code: { type: "string" },
            buyer_id: { type: "string", format: "uuid" },
            buyer_name: { type: "string" },
            property_id: { type: "string", format: "uuid" },
            property_title: { type: "string" },
            assigned_to: { type: "string", format: "uuid", nullable: true },
            assignee_name: { type: "string", nullable: true },
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
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer", minimum: 0 },
    },
  },

  AdminReferralDetailsResponse: {
    type: "object",
    required: ["referral"],
    properties: {
      referral: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          reference_code: { type: "string" },
          buyer_id: { type: "string", format: "uuid" },
          buyer_name: { type: "string" },
          buyer_email: { type: "string", format: "email" },
          property_id: { type: "string", format: "uuid" },
          property_title: { type: "string" },
          assigned_to: { type: "string", format: "uuid", nullable: true },
          assignee_name: { type: "string", nullable: true },
          assignee_email: {
            type: "string",
            format: "email",
            nullable: true,
          },
          message: { type: "string", nullable: true },
          status: { type: "string" },
          status_reason: { type: "string", nullable: true },
          assigned_at: { type: "string", format: "date-time", nullable: true },
          accepted_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
    },
  },

  ReassignReferralRequest: {
    type: "object",
    required: ["newAssigneeId"],
    properties: {
      newAssigneeId: {
        type: "string",
        format: "uuid",
        description: "ID of the agent or developer receiving the referral.",
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 1000,
        description: "Optional reason for the reassignment.",
      },
    },
    example: {
      newAssigneeId: "550e8400-e29b-41d4-a716-446655440000",
      reason: "Reassigning because of workload.",
    },
  },

  ReferralHistoryResponse: {
    type: "object",
    required: ["history"],
    properties: {
      history: {
        type: "array",
        items: {
          type: "object",
          properties: {
            referral_id: { type: "string", format: "uuid" },
            event_id: { type: "string", format: "uuid" },
            actor_id: { type: "string", format: "uuid", nullable: true },
            actor_name: { type: "string", nullable: true },
            event_type: { type: "string" },
            status: { type: "string", nullable: true },
            assigned_to: { type: "string", format: "uuid", nullable: true },
            assignee_name: { type: "string", nullable: true },
            previous_assigned_to: {
              type: "string",
              format: "uuid",
              nullable: true,
            },
            previous_assignee_name: { type: "string", nullable: true },
            note: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },

  CreateReferralFollowUpRequest: {
    type: "object",
    required: ["body"],
    properties: {
      body: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
      dueAt: {
        type: "string",
        format: "date-time",
        description: "Optional due date and time, including a timezone offset.",
      },
    },
    example: {
      body: "Call the buyer to discuss the property.",
      dueAt: "2026-11-20T10:00:00+03:00",
    },
  },

  CreateReferralFollowUpResponse: {
    type: "object",
    required: ["message", "followUp"],
    properties: {
      message: { type: "string" },
      followUp: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          referral_id: { type: "string", format: "uuid" },
          sender_id: { type: "string", format: "uuid" },
          kind: { type: "string" },
          body: { type: "string" },
          due_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },

  ReferralFollowUpsResponse: {
    type: "object",
    required: ["followUps", "pagination"],
    properties: {
      followUps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            referral_id: { type: "string", format: "uuid" },
            sender_id: { type: "string", format: "uuid" },
            sender_name: { type: "string" },
            body: { type: "string" },
            due_at: { type: "string", format: "date-time", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
      pagination: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer", minimum: 0 },
          totalPages: { type: "integer", minimum: 0 },
        },
      },
    },
  },

  CreateReferralMessageRequest: {
    type: "object",
    required: ["body"],
    properties: {
      body: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
    },
    example: {
      body: "Is the property still available?",
    },
  },

  CreateReferralMessageResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          referral_id: { type: "string", format: "uuid" },
          sender_id: { type: "string", format: "uuid" },
          kind: { type: "string" },
          body: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },

  ReferralMessagesResponse: {
    type: "object",
    required: ["messages", "pagination"],
    properties: {
      messages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            referral_id: { type: "string", format: "uuid" },
            sender_id: { type: "string", format: "uuid" },
            sender_name: { type: "string" },
            body: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
      pagination: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer", minimum: 0 },
          totalPages: { type: "integer", minimum: 0 },
        },
      },
    },
  },
} as const;
