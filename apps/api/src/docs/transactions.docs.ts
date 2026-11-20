import { error, jsonBody, jsonResponse } from "./shared";

const transactionIdParameter = {
  name: "transactionId",
  in: "path",
  required: true,
  description: "Unique ID of the transaction.",
  schema: { type: "string", format: "uuid" },
};

const transactionListPaginationParameters = [
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

const transactionStatusParameter = {
  name: "status",
  in: "query",
  required: false,
  schema: {
    type: "string",
    enum: ["submitted", "verified", "rejected"],
  },
};

const csvResponse = (filename: string) => ({
  description: "CSV file generated successfully.",
  headers: {
    "Content-Disposition": {
      description: "Download filename.",
      schema: {
        type: "string",
        example: `attachment; filename="${filename}"`,
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
});

export const transactionPaths = {
  "/api/v1/transactions": {
    post: {
      tags: ["Transactions"],
      summary: "Submit a transaction",
      operationId: "createTransaction",
      description:
        "Allows an approved agent or developer assigned to a referral to submit its transaction. The referral must have closed_won status, and only one transaction may exist for a referral. New transactions are created with submitted status.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("TransactionSubmissionRequest"),
      responses: {
        "201": jsonResponse(
          "Transaction submitted successfully.",
          "TransactionMutationResponse",
        ),
        "400": error("Invalid transaction input (INVALID_TRANSACTION_INPUT)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The referral is not assigned to the current seller (REFERRAL_NOT_ASSIGNED).",
        ),
        "404": error("Referral not found (REFERRAL_NOT_FOUND)."),
        "409": error(
          "The referral is not closed won (REFERRAL_NOT_CLOSED_WON), or a transaction already exists (DUPLICATE_TRANSACTION).",
        ),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
    get: {
      tags: ["Transactions"],
      summary: "List transactions",
      operationId: "listTransactions",
      description:
        "Returns transactions visible to the authenticated user. Buyers see their own transactions, agents and developers see transactions for which they are the seller, and administrators and finance administrators can see all transactions. Results are paginated and can be filtered by transaction status.",
      security: [{ AccessToken: [] }],
      parameters: [
        transactionStatusParameter,
        ...transactionListPaginationParameters,
      ],
      responses: {
        "200": jsonResponse(
          "Transactions retrieved successfully.",
          "TransactionListResponse",
        ),
        "400": error(
          "Invalid transaction filters or pagination values (INVALID_TRANSACTION_QUERY).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user is not allowed to list transactions (TRANSACTION_ACCESS_DENIED).",
        ),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
  },

  "/api/v1/transactions/export": {
    get: {
      tags: ["Transactions"],
      summary: "Export transactions as CSV",
      operationId: "exportTransactions",
      description:
        "Downloads a CSV file containing transactions visible to the authenticated agent, developer, administrator, or finance administrator. Supports status, creation-date range, and text search filters. Finance administrators receive an additional Notes column.",
      security: [{ AccessToken: [] }],
      parameters: [
        transactionStatusParameter,
        {
          name: "dateFrom",
          in: "query",
          required: false,
          description: "Include transactions created on or after this date.",
          schema: { type: "string", format: "date" },
        },
        {
          name: "dateTo",
          in: "query",
          required: false,
          description: "Include transactions created on or before this date.",
          schema: { type: "string", format: "date" },
        },
        {
          name: "q",
          in: "query",
          required: false,
          description:
            "Search transaction ID, referral reference, buyer name, seller name, or property title. Maximum 100 characters.",
          schema: { type: "string", minLength: 1, maxLength: 100 },
        },
      ],
      responses: {
        "200": csvResponse("sola-transactions.csv"),
        "400": error(
          "Invalid transaction export filters (INVALID_TRANSACTION_QUERY).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("The user does not have an allowed export role."),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
  },

  "/api/v1/transactions/{transactionId}": {
    parameters: [transactionIdParameter],
    get: {
      tags: ["Transactions"],
      summary: "Get transaction details",
      operationId: "getTransaction",
      description:
        "Returns transaction details with buyer, seller, and property names. The transaction is accessible to its buyer, its assigned seller, an administrator, or a finance administrator.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Transaction retrieved successfully.",
          "TransactionDetailResponse",
        ),
        "400": error("A transaction ID is required (INVALID_TRANSACTION_ID)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to this transaction (TRANSACTION_ACCESS_DENIED).",
        ),
        "404": error("Transaction not found (TRANSACTION_NOT_FOUND)."),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
    patch: {
      tags: ["Transactions"],
      summary: "Update a transaction",
      operationId: "updateTransaction",
      description:
        "Allows the agent or developer assigned to the transaction to update its sale amount, closing date, or notes. At least one field must be supplied. Only submitted or rejected transactions can be edited. Updating a rejected transaction resets its status to submitted and clears its previous rejection and review details.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("TransactionUpdateRequest"),
      responses: {
        "200": jsonResponse(
          "Transaction updated successfully.",
          "TransactionMutationResponse",
        ),
        "400": error(
          "A transaction ID is required (INVALID_TRANSACTION_ID), or the update body is invalid (INVALID_TRANSACTION_UPDATE).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to this transaction (TRANSACTION_ACCESS_DENIED).",
        ),
        "404": error("Transaction not found (TRANSACTION_NOT_FOUND)."),
        "409": error(
          "The transaction cannot be edited (TRANSACTION_NOT_EDITABLE).",
        ),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
  },

  "/api/v1/transactions/{transactionId}/documents": {
    parameters: [transactionIdParameter],
    get: {
      tags: ["Transactions"],
      summary: "Get transaction documents",
      operationId: "getTransactionDocuments",
      description:
        "Returns the supporting documents attached to a transaction. Each document includes a temporary signed download URL valid for one hour. Access is subject to the same transaction visibility rules as transaction details.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Transaction documents retrieved successfully.",
          "TransactionDocumentsResponse",
        ),
        "400": error("A transaction ID is required (INVALID_TRANSACTION_ID)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user does not have access to this transaction (TRANSACTION_ACCESS_DENIED).",
        ),
        "404": error("Transaction not found (TRANSACTION_NOT_FOUND)."),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
    post: {
      tags: ["Transactions"],
      summary: "Upload transaction documents",
      operationId: "uploadTransactionDocuments",
      description:
        "Allows the agent or developer assigned to the transaction to upload supporting documents. The service supports PDF, JPEG, PNG, and WebP files. Each uploaded file is stored and returned with a temporary signed download URL valid for one hour. The exact multipart field name and upload limits are defined by the transaction document upload middleware.",
      security: [{ AccessToken: [] }],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              $ref: "#/components/schemas/UploadTransactionDocumentsRequest",
            },
          },
        },
      },
      responses: {
        "201": jsonResponse(
          "Transaction documents uploaded successfully.",
          "UploadTransactionDocumentsResponse",
        ),
        "400": error(
          "Invalid transaction ID (INVALID_TRANSACTION_ID), no documents provided (DOCUMENTS_REQUIRED), unsupported file content (INVALID_DOCUMENT_TYPE), or invalid upload (INVALID_DOCUMENT_UPLOAD).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "Only the assigned seller can upload documents (TRANSACTION_ACCESS_DENIED).",
        ),
        "404": error("Transaction not found (TRANSACTION_NOT_FOUND)."),
        "413": error("A document exceeds 5 MB (FILE_TOO_LARGE)."),
        "500": error("An unexpected error occurred (INTERNAL_SERVER_ERROR)."),
      },
    },
  },

  "/api/v1/transactions/{transactionId}/decision": {
    parameters: [transactionIdParameter],
    post: {
      tags: ["Transactions"],
      summary: "Verify or reject a transaction",
      operationId: "decideTransaction",
      description:
        "Allows a finance administrator to verify or reject a submitted transaction. Rejection requires a reason. Verification also marks the associated property as sold and creates a commission using the applicable active seller-specific or platform commission agreement. The transaction must still be in submitted status.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("TransactionDecisionRequest"),
      responses: {
        "200": jsonResponse(
          "Transaction decision recorded successfully.",
          "TransactionMutationResponse",
        ),
        "400": error(
          "A transaction ID is required (INVALID_TRANSACTION_ID), the decision body is invalid (INVALID_TRANSACTION_DECISION), or a rejection reason is required.",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "Only finance administrators can decide transactions (TRANSACTION_DECISION_NOT_ALLOWED).",
        ),
        "404": error("Transaction not found (TRANSACTION_NOT_FOUND)."),
        "409": error(
          "The transaction has already been decided (TRANSACTION_ALREADY_DECIDED), or no active commission terms exist (NO_COMMISSION_TERMS).",
        ),
        "500": error(
          "An unexpected server error occurred (INTERNAL_SERVER_ERROR).",
        ),
      },
    },
  },
} as const;

export const transactionSchemas = {
  TransactionSubmissionRequest: {
    type: "object",
    required: ["referralId", "sale_amount", "closing_date"],
    properties: {
      referralId: {
        type: "string",
        format: "uuid",
      },
      sale_amount: {
        type: "number",
        exclusiveMinimum: 0,
      },
      closing_date: {
        type: "string",
        format: "date",
        description: "Valid closing date.",
      },
      notes: {
        type: "string",
        maxLength: 4000,
        nullable: true,
      },
    },
    additionalProperties: false,
    example: {
      referralId: "550e8400-e29b-41d4-a716-446655440000",
      sale_amount: 2500000,
      closing_date: "2026-12-15",
      notes: "Agreed sale amount after negotiation.",
    },
  },

  TransactionUpdateRequest: {
    type: "object",
    minProperties: 1,
    properties: {
      sale_amount: {
        type: "number",
        exclusiveMinimum: 0,
      },
      closing_date: {
        type: "string",
        format: "date",
      },
      notes: {
        type: "string",
        maxLength: 4000,
        nullable: true,
        description: "Send null to clear the existing notes.",
      },
    },
    additionalProperties: false,
    example: {
      sale_amount: 2600000,
      notes: "Updated agreement details.",
    },
  },

  TransactionDecisionRequest: {
    type: "object",
    required: ["decision"],
    properties: {
      decision: {
        type: "string",
        enum: ["verified", "rejected"],
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
        description: "Required when decision is rejected.",
      },
    },
    additionalProperties: false,
    example: {
      decision: "rejected",
      reason:
        "The submitted sale amount does not match the supporting documents.",
    },
  },

  TransactionRecord: {
    type: "object",
    required: [
      "id",
      "referral_id",
      "buyer_id",
      "property_id",
      "seller_id",
      "sale_amount",
      "closing_date",
      "notes",
      "status",
      "rejection_reason",
      "reviewed_by",
      "reviewed_at",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      referral_id: { type: "string", format: "uuid" },
      buyer_id: { type: "string", format: "uuid" },
      property_id: { type: "string", format: "uuid" },
      seller_id: { type: "string", format: "uuid" },
      sale_amount: {
        type: "string",
        description: "PostgreSQL NUMERIC value serialized as a string.",
        example: "2500000.00",
      },
      closing_date: { type: "string", format: "date" },
      notes: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: ["submitted", "verified", "rejected"],
      },
      rejection_reason: { type: "string", nullable: true },
      reviewed_by: { type: "string", format: "uuid", nullable: true },
      reviewed_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },

  TransactionListItem: {
    allOf: [
      { $ref: "#/components/schemas/TransactionRecord" },
      {
        type: "object",
        required: ["buyer_name", "seller_name", "property_title"],
        properties: {
          buyer_name: { type: "string" },
          seller_name: { type: "string" },
          property_title: { type: "string" },
        },
      },
    ],
  },

  TransactionDetail: {
    allOf: [
      { $ref: "#/components/schemas/TransactionRecord" },
      {
        type: "object",
        required: ["buyer_name", "seller_name", "property_title"],
        properties: {
          buyer_name: { type: "string" },
          seller_name: { type: "string" },
          property_title: { type: "string" },
        },
      },
    ],
  },

  TransactionMutationResponse: {
    type: "object",
    required: ["message", "transaction"],
    properties: {
      message: { type: "string" },
      transaction: {
        $ref: "#/components/schemas/TransactionRecord",
      },
    },
  },

  TransactionDetailResponse: {
    type: "object",
    required: ["transaction"],
    properties: {
      transaction: {
        $ref: "#/components/schemas/TransactionDetail",
      },
    },
  },

  TransactionListResponse: {
    type: "object",
    required: ["items", "page", "limit", "total"],
    properties: {
      items: {
        type: "array",
        items: {
          $ref: "#/components/schemas/TransactionListItem",
        },
      },
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer", minimum: 0 },
    },
  },

  TransactionDocument: {
    type: "object",
    required: [
      "id",
      "transaction_id",
      "file_name",
      "mime_type",
      "size_bytes",
      "uploaded_by",
      "created_at",
      "url",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      transaction_id: { type: "string", format: "uuid" },
      file_name: { type: "string" },
      mime_type: {
        type: "string",
        enum: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      },
      size_bytes: { type: "integer", minimum: 0 },
      uploaded_by: { type: "string", format: "uuid" },
      created_at: { type: "string", format: "date-time" },
      url: {
        type: "string",
        format: "uri",
        description: "Temporary signed download URL, valid for one hour.",
      },
    },
  },

  TransactionDocumentsResponse: {
    type: "object",
    required: ["transactionId", "documents"],
    properties: {
      transactionId: { type: "string", format: "uuid" },
      documents: {
        type: "array",
        items: {
          $ref: "#/components/schemas/TransactionDocument",
        },
      },
    },
  },

  UploadTransactionDocumentsRequest: {
    type: "object",
    required: ["documents"],
    properties: {
      documents: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        description:
          "Upload between 1 and 10 PDF, JPEG, PNG, or WebP files. Maximum 5 MB per file.",
        items: {
          type: "string",
          format: "binary",
        },
      },
    },
  },

  UploadTransactionDocumentsResponse: {
    type: "object",
    required: ["message", "documents"],
    properties: {
      message: { type: "string" },
      documents: {
        type: "array",
        items: {
          $ref: "#/components/schemas/TransactionDocument",
        },
      },
    },
  },
} as const;
