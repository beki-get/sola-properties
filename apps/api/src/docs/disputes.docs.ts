
import { error, jsonBody, jsonResponse } from "./shared";

const disputeIdParameter = {
  name: "disputeId",
  in: "path",
  required: true,
  description: "Unique ID of the dispute.",
  schema: { type: "string", format: "uuid" },
};

const transactionIdParameter = {
  name: "transactionId",
  in: "path",
  required: true,
  description: "Unique ID of the transaction.",
  schema: { type: "string", format: "uuid" },
};

const commissionIdParameter = {
  name: "commissionId",
  in: "path",
  required: true,
  description: "Unique ID of the commission.",
  schema: { type: "string", format: "uuid" },
};

const disputePaginationParameters = [
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
  {
    name: "status",
    in: "query",
    required: false,
    schema: {
      type: "string",
      enum: ["open", "resolved", "rejected"],
    },
  },
];

export const disputePaths = {
  "/api/v1/disputes/{disputeId}/decision": {
    parameters: [disputeIdParameter],
    patch: {
      tags: ["Disputes"],
      summary: "Resolve or reject a dispute",
      operationId: "decideTransactionDispute",
      description:
        "Allows an administrator or finance administrator to resolve or reject an open transaction or commission dispute. A resolution note is required. The decision is recorded with the reviewing user and timestamp. The buyer and seller are notified for transaction disputes; the seller is notified for commission disputes.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("DisputeDecisionRequest"),
      responses: {
        "200": jsonResponse(
          "Dispute decision recorded successfully.",
          "DisputeDecisionResponse",
        ),
        "400": error(
          "A dispute ID is required (INVALID_DISPUTE_ID), or the decision and resolution note are invalid (INVALID_DISPUTE_DECISION).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("Only administrators and finance administrators can decide disputes (DISPUTE_DECISION_NOT_ALLOWED)."),
        "404": error(
          "Dispute not found (DISPUTE_NOT_FOUND), or its related transaction or commission was not found.",
        ),
        "409": error("The dispute has already been decided (DISPUTE_ALREADY_CLOSED)."),
        "500": error("An unexpected server error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/disputes/{transactionId}/disputes": {
    parameters: [transactionIdParameter],
    post: {
      tags: ["Disputes"],
      summary: "Open a transaction dispute",
      operationId: "openTransactionDispute",
      description:
        "Allows the agent or developer assigned to a transaction, an administrator, or a finance administrator to open a dispute by providing a reason. The query checks for an existing open dispute before inserting a new one. Unauthorized callers and missing transactions receive the same not-found response.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("DisputeSubmissionRequest"),
      responses: {
        "201": jsonResponse(
          "Transaction dispute opened successfully.",
          "TransactionDisputeMutationResponse",
        ),
        "400": error(
          "A transaction ID is required (INVALID_TRANSACTION_ID), or the dispute reason is invalid (INVALID_DISPUTE_INPUT).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("The user's role is not allowed to open a transaction dispute."),
        "404": error("Transaction not found or the user is not authorized to access it (TRANSACTION_NOT_FOUND)."),
        "409": error("An open dispute already exists for this transaction (OPEN_DISPUTE_EXISTS)."),
        "500": error("An unexpected server error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
    get: {
      tags: ["Disputes"],
      summary: "List transaction disputes",
      operationId: "listTransactionDisputes",
      description:
        "Returns paginated disputes for a transaction. The assigned agent or developer, administrators, and finance administrators can retrieve the records. Results can be filtered by dispute status.",
      security: [{ AccessToken: [] }],
      parameters: disputePaginationParameters,
      responses: {
        "200": jsonResponse(
          "Transaction disputes retrieved successfully.",
          "DisputeListResponse",
        ),
        "400": error(
          "A transaction ID is required (INVALID_TRANSACTION_ID), or dispute filters and pagination values are invalid (INVALID_DISPUTE_QUERY).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("The user's role is not allowed to list transaction disputes."),
        "404": error("Transaction not found or the user is not authorized to access it (TRANSACTION_NOT_FOUND)."),
        "500": error("An unexpected server error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/disputes/commissions/{commissionId}/disputes": {
    parameters: [commissionIdParameter],
    post: {
      tags: ["Disputes"],
      summary: "Open a commission dispute",
      operationId: "openCommissionDispute",
      description:
        "Allows the agent or developer who owns the commission to open a dispute by providing a reason. Approved administrators and finance administrators are notified after the dispute is created. The response includes the number of notifications successfully created.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("DisputeSubmissionRequest"),
      responses: {
        "201": jsonResponse(
          "Commission dispute opened successfully.",
          "CommissionDisputeMutationResponse",
        ),
        "400": error(
          "A commission ID is required (INVALID_COMMISSION_ID), or the dispute reason is invalid (INVALID_DISPUTE_INPUT).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("Only agents and developers can open commission disputes."),
        "404": error("Commission not found or the user is not authorized to access it (COMMISSION_NOT_FOUND)."),
        "409": error("An open dispute already exists for this commission (OPEN_DISPUTE_EXISTS)."),
        "500": error("An unexpected server error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
    get: {
      tags: ["Disputes"],
      summary: "List commission disputes",
      operationId: "listCommissionDisputes",
      description:
        "Returns paginated disputes for a commission. The commission's seller, administrators, and finance administrators can retrieve the records. Results can be filtered by dispute status.",
      security: [{ AccessToken: [] }],
      parameters: disputePaginationParameters,
      responses: {
        "200": jsonResponse(
          "Commission disputes retrieved successfully.",
          "DisputeListResponse",
        ),
        "400": error(
          "A commission ID is required (INVALID_COMMISSION_ID), or dispute filters and pagination values are invalid (INVALID_DISPUTE_QUERY).",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("The user's role is not allowed to list commission disputes."),
        "404": error("Commission not found or the user is not authorized to access it (COMMISSION_NOT_FOUND)."),
        "500": error("An unexpected server error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },
} as const;


export const disputeSchemas = {
  DisputeSubmissionRequest: {
    type: "object",
    required: ["reason"],
    properties: {
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 4000,
        description: "Reason for opening the dispute.",
      },
    },
    additionalProperties: false,
    example: {
      reason: "The transaction details do not match the agreed sale terms.",
    },
  },

  DisputeDecisionRequest: {
    type: "object",
    required: ["decision", "resolution_note"],
    properties: {
      decision: {
        type: "string",
        enum: ["resolved", "rejected"],
      },
      resolution_note: {
        type: "string",
        minLength: 1,
        maxLength: 4000,
        description: "Explanation of the dispute decision.",
      },
    },
    additionalProperties: false,
    example: {
      decision: "resolved",
      resolution_note: "The submitted supporting documents were reviewed and the issue was resolved.",
    },
  },

  DisputeRecord: {
    type: "object",
    required: [
      "id",
      "entity_type",
      "entity_id",
      "reported_by",
      "reason",
      "status",
      "resolution_note",
      "resolved_by",
      "resolved_at",
      "created_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      entity_type: {
        type: "string",
        enum: ["transaction", "commission"],
      },
      entity_id: {
        type: "string",
        format: "uuid",
        description: "ID of the disputed transaction or commission.",
      },
      reported_by: { type: "string", format: "uuid" },
      reason: { type: "string" },
      status: {
        type: "string",
        enum: ["open", "resolved", "rejected"],
      },
      resolution_note: { type: "string", nullable: true },
      resolved_by: {
        type: "string",
        format: "uuid",
        nullable: true,
      },
      resolved_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      created_at: { type: "string", format: "date-time" },
    },
  },

  TransactionDisputeMutationResponse: {
    type: "object",
    required: ["message", "dispute"],
    properties: {
      message: { type: "string" },
      dispute: {
        $ref: "#/components/schemas/DisputeRecord",
      },
    },
  },

  CommissionDisputeMutationResponse: {
    type: "object",
    required: ["message", "dispute", "notificationsCreated"],
    properties: {
      message: { type: "string" },
      dispute: {
        $ref: "#/components/schemas/DisputeRecord",
      },
      notificationsCreated: {
        type: "integer",
        minimum: 0,
        description: "Number of administrator notifications successfully created.",
      },
    },
  },

  DisputeDecisionResponse: {
    type: "object",
    required: ["message", "dispute", "notificationsCreated"],
    properties: {
      message: { type: "string" },
      dispute: {
        $ref: "#/components/schemas/DisputeRecord",
      },
      notificationsCreated: {
        type: "integer",
        minimum: 0,
        description: "Number of participant notifications successfully created.",
      },
    },
  },

  DisputeListResponse: {
    type: "object",
    required: ["items", "page", "limit", "total"],
    properties: {
      items: {
        type: "array",
        items: {
          $ref: "#/components/schemas/DisputeRecord",
        },
      },
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer", minimum: 0 },
    },
  },
} as const;
