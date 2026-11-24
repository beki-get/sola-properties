import { error, jsonBody, jsonResponse } from "./shared";

const paginationParameters = [
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

export const referralOperationsPaths = {
  "/api/v1/referral/buyer/me/visits": {
    post: {
      tags: ["Referrals"],
      summary: "Request a property visit",
      operationId: "createBuyerVisitRequest",
      description:
        "Allows an approved buyer to request a visit for their own referral. The referral must be accepted, in progress, or in agreement. The requested date and time must be in the future. A referral can have only one active visit at a time.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateBuyerVisitRequest"),
      responses: {
        "201": jsonResponse(
          "Property visit requested successfully.",
          "PropertyVisitMutationResponse",
        ),
        "400": error("Invalid visit request data (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to the referral (REFERRAL_ACCESS_DENIED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "409": error(
          "The referral is not eligible for a visit (REFERRAL_NOT_ELIGIBLE), or an active visit already exists (ACTIVE_VISIT_EXISTS).",
        ),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
    get: {
      tags: ["Referrals"],
      summary: "Get the current buyer's property visits",
      operationId: "getBuyerVisits",
      description:
        "Returns property visits associated with referrals belonging to the authenticated buyer, ordered newest first. Results are paginated.",
      security: [{ AccessToken: [] }],
      parameters: paginationParameters,
      responses: {
        "200": jsonResponse(
          "Buyer property visits retrieved successfully.",
          "BuyerPropertyVisitsResponse",
        ),
        "400": error("Invalid pagination parameters (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("An approved buyer account is required."),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/referral/{referralId}/visits": {
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
      summary: "Get visits for an assigned referral",
      operationId: "getSellerVisits",
      description:
        "Allows the agent or developer assigned to the referral to view its property visits. The referral must be accepted, in progress, or in agreement. Results are paginated.",
      security: [{ AccessToken: [] }],
      parameters: paginationParameters,
      responses: {
        "200": jsonResponse(
          "Referral property visits retrieved successfully.",
          "SellerPropertyVisitsResponse",
        ),
        "400": error(
          "Invalid referral ID or pagination parameters (VALIDATION_ERROR).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user is not assigned to the referral (REFERRAL_ACCESS_DENIED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "409": error(
          "The referral is not eligible for active property visits (REFERRAL_NOT_ELIGIBLE).",
        ),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/referral/visits/{visitId}/schedule": {
    parameters: [
      {
        name: "visitId",
        in: "path",
        required: true,
        description: "Unique ID of the requested property visit.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: {
      tags: ["Referrals"],
      summary: "Schedule a requested property visit",
      operationId: "schedulePropertyVisit",
      description:
        "Allows the agent or developer assigned to the referral to schedule a requested visit. Only visits with requested status can be scheduled, and the referral must be eligible for active visits. The scheduled date and time must be in the future.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("SchedulePropertyVisitRequest"),
      responses: {
        "200": jsonResponse(
          "Property visit scheduled successfully.",
          "PropertyVisitMutationResponse",
        ),
        "400": error("Invalid visit ID or scheduling data (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user is not assigned to the referral (VISIT_ACCESS_DENIED).",
        ),
        "404": error("Property visit not found (VISIT_NOT_FOUND)."),
        "409": error(
          "The referral is not eligible (REFERRAL_NOT_ELIGIBLE), or the visit is not in requested status (VISIT_NOT_REQUESTED).",
        ),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/referral/visits/{visitId}": {
    parameters: [
      {
        name: "visitId",
        in: "path",
        required: true,
        description: "Unique ID of the property visit.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: {
      tags: ["Referrals"],
      summary: "Update a scheduled property visit",
      operationId: "updatePropertyVisit",
      description:
        "Allows the agent or developer assigned to the referral to update a scheduled visit's date, location, or notes. Only visits with scheduled status can be updated. At least one update field must be provided. The new scheduled date and time, when provided, must be in the future. Send null for location or notes to clear those fields.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("UpdatePropertyVisitRequest"),
      responses: {
        "200": jsonResponse(
          "Property visit updated successfully.",
          "PropertyVisitMutationResponse",
        ),
        "400": error(
          "Invalid visit ID or visit update data (VALIDATION_ERROR).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user is not assigned to the referral (VISIT_ACCESS_DENIED).",
        ),
        "404": error("Property visit not found (VISIT_NOT_FOUND)."),
        "409": error(
          "The referral is not eligible (REFERRAL_NOT_ELIGIBLE), or the visit is not editable (VISIT_NOT_EDITABLE).",
        ),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/referral/visits/{visitId}/cancel": {
    parameters: [
      {
        name: "visitId",
        in: "path",
        required: true,
        description: "Unique ID of the property visit.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: {
      tags: ["Referrals"],
      summary: "Cancel a property visit",
      operationId: "cancelPropertyVisit",
      description:
        "Allows the buyer who owns the referral or the agent/developer assigned to it to cancel a visit. Only visits with requested or scheduled status can be cancelled.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Property visit cancelled successfully.",
          "PropertyVisitMutationResponse",
        ),
        "400": error("Invalid visit ID (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to the visit (VISIT_ACCESS_DENIED).",
        ),
        "404": error("Property visit not found (VISIT_NOT_FOUND)."),
        "409": error(
          "Only requested or scheduled visits can be cancelled (VISIT_NOT_CANCELLABLE).",
        ),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/referral/visits/{visitId}/outcome": {
    parameters: [
      {
        name: "visitId",
        in: "path",
        required: true,
        description: "Unique ID of the property visit.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: {
      tags: ["Referrals"],
      summary: "Record a property visit outcome",
      operationId: "recordPropertyVisitOutcome",
      description:
        "Allows the agent or developer assigned to the referral to record the visit outcome. The visit must be scheduled, its scheduled time must have arrived, and it must not already be completed or cancelled. Recording an outcome changes the visit status to completed.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("PropertyVisitOutcomeRequest"),
      responses: {
        "200": jsonResponse(
          "Property visit outcome recorded successfully.",
          "PropertyVisitMutationResponse",
        ),
        "400": error(
          "Invalid visit ID or visit outcome data (VALIDATION_ERROR).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user is not assigned to the referral (VISIT_ACCESS_DENIED).",
        ),
        "404": error("Property visit not found (VISIT_NOT_FOUND)."),
        "409": error(
          "The visit is cancelled (VISIT_CANCELLED), not scheduled (VISIT_NOT_SCHEDULED), already completed (VISIT_ALREADY_COMPLETED), or its scheduled time has not arrived (VISIT_NOT_YET_HELD).",
        ),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },
} as const;

export const referralOperationsSchemas = {
  CreateBuyerVisitRequest: {
    type: "object",
    required: ["referralId", "requestedAt"],
    properties: {
      referralId: {
        type: "string",
        format: "uuid",
        description: "Referral for which the buyer is requesting a visit.",
      },
      requestedAt: {
        type: "string",
        format: "date-time",
        description: "Requested visit date and time. Must be in the future.",
      },
      location: {
        type: "string",
        minLength: 1,
        maxLength: 500,
        description: "Optional location for the visit.",
      },
      notes: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
        description: "Optional notes about the visit request.",
      },
    },
    example: {
      referralId: "550e8400-e29b-41d4-a716-446655440000",
      requestedAt: "2026-11-25T10:00:00+03:00",
      location: "Main entrance of the property",
      notes: "Please confirm the visit with me beforehand.",
    },
  },

  SchedulePropertyVisitRequest: {
    type: "object",
    required: ["scheduledAt"],
    properties: {
      scheduledAt: {
        type: "string",
        format: "date-time",
        description: "Scheduled visit date and time. Must be in the future.",
      },
      location: {
        type: "string",
        minLength: 1,
        maxLength: 500,
      },
      notes: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
    },
    example: {
      scheduledAt: "2026-11-25T10:00:00+03:00",
      location: "Main entrance of the property",
      notes: "The agent will meet the buyer at the entrance.",
    },
  },

  UpdatePropertyVisitRequest: {
    type: "object",
    minProperties: 1,
    properties: {
      scheduledAt: {
        type: "string",
        format: "date-time",
        description:
          "Optional new scheduled date and time. Must be in the future.",
      },
      location: {
        type: "string",
        minLength: 1,
        maxLength: 500,
        nullable: true,
        description:
          "New visit location. Send null to clear the existing location.",
      },
      notes: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
        nullable: true,
        description: "Updated notes. Send null to clear the existing notes.",
      },
    },
    example: {
      scheduledAt: "2026-11-26T11:00:00+03:00",
      location: "Updated meeting location",
      notes: null,
    },
  },

  PropertyVisitOutcomeRequest: {
    type: "object",
    required: ["outcome"],
    properties: {
      outcome: {
        type: "string",
        enum: ["interested", "not_interested", "requested_another_visit"],
      },
      outcomeNote: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
    },
    example: {
      outcome: "interested",
      outcomeNote:
        "The buyer liked the property and wants to discuss the next steps.",
    },
  },

  PropertyVisit: {
    type: "object",
    required: [
      "id",
      "referral_id",
      "requested_at",
      "status",
      "created_by",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      referral_id: { type: "string", format: "uuid" },
      requested_at: { type: "string", format: "date-time" },
      scheduled_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      location: { type: "string", nullable: true },
      notes: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: ["requested", "scheduled", "cancelled", "completed"],
      },
      created_by: { type: "string", format: "uuid" },
      cancelled_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      outcome: {
        type: "string",
        enum: ["interested", "not_interested", "requested_another_visit"],
        nullable: true,
      },
      outcome_note: { type: "string", nullable: true },
      outcome_recorded_by: {
        type: "string",
        format: "uuid",
        nullable: true,
      },
      outcome_recorded_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      outcome_history: {
        type: "array",
        items: {
          type: "object",
          properties: {
            outcome: {
              type: "string",
              enum: ["interested", "not_interested", "requested_another_visit"],
            },
            outcomeNote: { type: "string", nullable: true },
            recordedBy: { type: "string", format: "uuid" },
            recordedAt: { type: "string", format: "date-time" },
          },
        },
      },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },

  PropertyVisitMutationResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/PropertyVisit",
      },
    },
  },

  BuyerPropertyVisitsResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "object",
        required: ["visits", "pagination"],
        properties: {
          visits: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/PropertyVisit" },
                {
                  type: "object",
                  required: ["reference_code", "property_title"],
                  properties: {
                    reference_code: { type: "string" },
                    property_title: { type: "string" },
                  },
                },
              ],
            },
          },
          pagination: {
            $ref: "#/components/schemas/VisitPagination",
          },
        },
      },
    },
  },

  SellerPropertyVisitsResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "object",
        required: ["visits", "pagination"],
        properties: {
          visits: {
            type: "array",
            items: {
              $ref: "#/components/schemas/PropertyVisit",
            },
          },
          pagination: {
            $ref: "#/components/schemas/VisitPagination",
          },
        },
      },
    },
  },

  VisitPagination: {
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
