import { error, jsonBody, jsonResponse } from "./shared";

const commissionIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "Unique ID of the commission.",
  schema: { type: "string", format: "uuid" },
};

const commissionPaginationParameters = [
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

const commissionFilterParameters = [
  {
    name: "status",
    in: "query",
    required: false,
    schema: {
      type: "string",
      enum: ["pending", "approved", "paid"],
    },
  },
  {
    name: "dateFrom",
    in: "query",
    required: false,
    description: "Include commissions created on or after this date.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "dateTo",
    in: "query",
    required: false,
    description: "Include commissions created on or before this date.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "sellerId",
    in: "query",
    required: false,
    description:
      "Filter by seller ID. Only administrators and finance administrators may supply this parameter.",
    schema: { type: "string", format: "uuid" },
  },
];

const commissionCsvResponse = {
  description: "Commission CSV file generated successfully.",
  headers: {
    "Content-Disposition": {
      description: "Download filename.",
      schema: {
        type: "string",
        example: 'attachment; filename="sola-commissions.csv"',
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
};

export const commissionManagementPaths = {
  "/api/v1/commission-agreements": {
    get: {
      tags: ["Commission Management"],
      summary: "List commission agreements",
      operationId: "getCommissionAgreements",
      description:
        "Returns paginated commission agreements. Administrators and finance administrators can view all agreements. Agents and developers can only view agreements belonging to themselves.",
      security: [{ AccessToken: [] }],
      parameters: commissionPaginationParameters,
      responses: {
        "200": jsonResponse(
          "Commission agreements retrieved successfully.",
          "CommissionAgreementsResponse",
        ),
        "400": error("Invalid pagination parameters (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user's role is not allowed to retrieve commission agreements.",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },

    post: {
      tags: ["Commission Management"],
      summary: "Create a commission agreement",
      operationId: "createCommissionAgreement",
      description:
        "Allows a finance administrator to create a commission agreement for an approved agent or developer. If sellerId is omitted, the agreement is created as the platform default. Creating a new agreement closes the currently active agreement for the same seller or platform default.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateCommissionAgreementRequest"),
      responses: {
        "201": jsonResponse(
          "Commission agreement created successfully.",
          "CommissionAgreementMutationResponse",
        ),
        "400": error("Invalid commission agreement data (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "Only finance administrators can create commission agreements.",
        ),
        "404": error("Approved seller not found (APPROVED_SELLER_NOT_FOUND)."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/commissions": {
    get: {
      tags: ["Commission Management"],
      summary: "List commissions",
      operationId: "getCommissions",
      description:
        "Returns paginated commission records with payment, adjustment, and outstanding-balance summaries. Agents and developers can only view their own commissions. Administrators and finance administrators can view all commissions or filter by seller. Supports status and creation-date filters.",
      security: [{ AccessToken: [] }],
      parameters: [
        ...commissionFilterParameters,
        ...commissionPaginationParameters,
      ],
      responses: {
        "200": jsonResponse(
          "Commissions retrieved successfully.",
          "CommissionsResponse",
        ),
        "400": error("Invalid commission query parameters (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user cannot retrieve commissions for another seller (FORBIDDEN).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/commissions/export": {
    get: {
      tags: ["Commission Management"],
      summary: "Export commissions as CSV",
      operationId: "exportCommissions",
      description:
        "Allows a finance administrator to download commission records as a CSV file. Supports filtering by commission status, creation-date range, and seller ID. The export includes commission amounts, adjustments, payments, outstanding balances, and transaction/property details.",
      security: [{ AccessToken: [] }],
      parameters: commissionFilterParameters,
      responses: {
        "200": commissionCsvResponse,
        "400": error("Invalid commission query parameters (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("Only finance administrators can export commissions."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/commissions/{id}": {
    parameters: [commissionIdParameter],
    get: {
      tags: ["Commission Management"],
      summary: "Get a commission statement",
      operationId: "getCommissionStatement",
      description:
        "Returns a detailed commission statement, including transaction and property information, commission calculations, adjustments, payments, and the outstanding balance. Agents and developers can only access their own commission statements; administrators and finance administrators can access all statements.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Commission statement retrieved successfully.",
          "CommissionStatementResponse",
        ),
        "400": error("Invalid commission ID (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "The user's role is not allowed to retrieve commission statements.",
        ),
        "404": error(
          "Commission not found or not accessible (COMMISSION_NOT_FOUND).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/commissions/{id}/approve": {
    parameters: [commissionIdParameter],
    post: {
      tags: ["Commission Management"],
      summary: "Approve a commission",
      operationId: "approveCommission",
      description:
        "Allows a finance administrator to approve a pending commission. The approval is recorded with the reviewing administrator and timestamp. An approval notification is sent to the seller.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Commission approved successfully.",
          "CommissionApprovalResponse",
        ),
        "400": error("Invalid commission ID (VALIDATION_ERROR)."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("Only finance administrators can approve commissions."),
        "404": error("Commission not found (COMMISSION_NOT_FOUND)."),
        "409": error(
          "Only pending commissions can be approved (COMMISSION_NOT_PENDING).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/commissions/{id}/adjustments": {
    parameters: [commissionIdParameter],
    post: {
      tags: ["Commission Management"],
      summary: "Create a commission adjustment",
      operationId: "createCommissionAdjustment",
      description:
        "Allows a finance administrator to record a positive or negative adjustment to a commission. An adjustment cannot reduce the amount owed below zero or below the amount already paid. The resulting commission status is updated according to the outstanding balance. The seller is notified of the adjustment.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreateCommissionAdjustmentRequest"),
      responses: {
        "201": jsonResponse(
          "Commission adjustment recorded successfully.",
          "CommissionAdjustmentResponse",
        ),
        "400": error(
          "Invalid commission ID or adjustment data (VALIDATION_ERROR).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "Only finance administrators can create commission adjustments.",
        ),
        "404": error("Commission not found (COMMISSION_NOT_FOUND)."),
        "409": error(
          "The adjustment would reduce the amount owed below zero or below the amount already paid (INVALID_COMMISSION_ADJUSTMENT).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/commissions/{id}/payments": {
    parameters: [commissionIdParameter],
    post: {
      tags: ["Commission Management"],
      summary: "Record a commission payment",
      operationId: "recordCommissionPayment",
      description:
        "Allows a finance administrator to record a payment against an approved commission. The payment date cannot be in the future, and the payment cannot exceed the outstanding amount owed. When the commission is fully paid, its status changes to paid. The seller is notified after the payment is recorded.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("RecordCommissionPaymentRequest"),
      responses: {
        "201": jsonResponse(
          "Commission payment recorded successfully.",
          "CommissionPaymentResponse",
        ),
        "400": error(
          "Invalid commission ID or payment data (VALIDATION_ERROR), or the payment date is in the future (INVALID_PAYMENT_DATE).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error(
          "Only finance administrators can record commission payments.",
        ),
        "404": error("Commission not found (COMMISSION_NOT_FOUND)."),
        "409": error(
          "The commission is not approved (COMMISSION_NOT_APPROVED), or the payment exceeds the outstanding balance (PAYMENT_EXCEEDS_OUTSTANDING).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },
} as const;

export const commissionManagementSchemas = {
  CreateCommissionAgreementRequest: {
    type: "object",
    required: ["commissionRatePct", "platformSharePct"],
    properties: {
      sellerId: {
        type: "string",
        format: "uuid",
        description:
          "Optional approved agent or developer. Omit to create a platform-default agreement.",
      },
      commissionRatePct: {
        type: "number",
        exclusiveMinimum: 0,
        maximum: 100,
        description: "Commission rate as a percentage.",
      },
      platformSharePct: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description:
          "Platform's share of the total commission as a percentage.",
      },
    },
    additionalProperties: false,
    example: {
      sellerId: "550e8400-e29b-41d4-a716-446655440000",
      commissionRatePct: 5,
      platformSharePct: 30,
    },
  },

  CommissionAgreement: {
    type: "object",
    required: [
      "id",
      "seller_id",
      "commission_rate_pct",
      "platform_share_pct",
      "effective_from",
      "effective_to",
      "created_by",
      "created_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      seller_id: {
        type: "string",
        format: "uuid",
        nullable: true,
        description: "Null for a platform-default agreement.",
      },
      commission_rate_pct: {
        type: "string",
        description: "PostgreSQL numeric value serialized as a string.",
      },
      platform_share_pct: {
        type: "string",
        description: "PostgreSQL numeric value serialized as a string.",
      },
      effective_from: { type: "string", format: "date-time" },
      effective_to: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      created_by: { type: "string", format: "uuid" },
      created_at: { type: "string", format: "date-time" },
    },
  },

  CommissionAgreementMutationResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/CommissionAgreement",
      },
    },
  },

  CommissionAgreementsResponse: {
    type: "object",
    required: ["message", "data", "pagination"],
    properties: {
      message: { type: "string" },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/CommissionAgreement",
        },
      },
      pagination: {
        $ref: "#/components/schemas/CommissionPagination",
      },
    },
  },

  CommissionPagination: {
    type: "object",
    required: ["page", "limit", "total", "totalPages"],
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer", minimum: 0 },
      totalPages: { type: "integer", minimum: 0 },
    },
  },

  CommissionListItem: {
    type: "object",
    required: [
      "id",
      "transactionId",
      "sellerId",
      "agreementId",
      "saleAmount",
      "commissionRatePct",
      "platformSharePct",
      "totalCommission",
      "platformAmount",
      "sellerAmount",
      "adjustmentTotal",
      "amountOwed",
      "paidTotal",
      "outstanding",
      "status",
      "createdAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      transactionId: { type: "string", format: "uuid" },
      sellerId: { type: "string", format: "uuid" },
      agreementId: { type: "string", format: "uuid" },
      saleAmount: {
        type: "string",
        description: "Monetary amount serialized as a decimal string.",
      },
      commissionRatePct: { type: "string" },
      platformSharePct: { type: "string" },
      totalCommission: { type: "string" },
      platformAmount: { type: "string" },
      sellerAmount: { type: "string" },
      adjustmentTotal: { type: "string" },
      amountOwed: { type: "string" },
      paidTotal: { type: "string" },
      outstanding: { type: "string" },
      status: {
        type: "string",
        enum: ["pending", "approved", "paid"],
      },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  CommissionSummary: {
    type: "object",
    required: [
      "total_commission",
      "platform_amount",
      "adjustment_total",
      "amount_owed",
      "paid_total",
      "outstanding",
    ],
    properties: {
      total_commission: { type: "string" },
      platform_amount: { type: "string" },
      adjustment_total: { type: "string" },
      amount_owed: { type: "string" },
      paid_total: { type: "string" },
      outstanding: { type: "string" },
    },
  },

  CommissionsResponse: {
    type: "object",
    required: ["message", "data", "summary", "pagination"],
    properties: {
      message: { type: "string" },
      data: {
        type: "array",
        items: {
          $ref: "#/components/schemas/CommissionListItem",
        },
      },
      summary: {
        $ref: "#/components/schemas/CommissionSummary",
      },
      pagination: {
        $ref: "#/components/schemas/CommissionPagination",
      },
    },
  },

  CommissionPaymentRecord: {
    type: "object",
    required: [
      "id",
      "commission_id",
      "amount",
      "paid_on",
      "recorded_by",
      "created_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      commission_id: { type: "string", format: "uuid" },
      amount: { type: "string" },
      paid_on: { type: "string", format: "date" },
      reference: { type: "string", nullable: true },
      recorded_by: { type: "string", format: "uuid" },
      created_at: { type: "string", format: "date-time" },
    },
  },

  CommissionStatement: {
    type: "object",
    required: [
      "id",
      "transaction_id",
      "seller_id",
      "agreement_id",
      "sale_amount",
      "commission_rate_pct",
      "platform_share_pct",
      "total_commission",
      "platform_amount",
      "seller_amount",
      "status",
      "created_at",
      "property_title",
      "reference_code",
      "payments",
      "adjustment_total",
      "amount_owed",
      "paid_total",
      "outstanding",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      transaction_id: { type: "string", format: "uuid" },
      seller_id: { type: "string", format: "uuid" },
      agreement_id: { type: "string", format: "uuid" },
      sale_amount: { type: "string" },
      commission_rate_pct: { type: "string" },
      platform_share_pct: { type: "string" },
      total_commission: { type: "string" },
      platform_amount: { type: "string" },
      seller_amount: { type: "string" },
      status: {
        type: "string",
        enum: ["pending", "approved", "paid"],
      },
      approved_by: {
        type: "string",
        format: "uuid",
        nullable: true,
      },
      approved_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      created_at: { type: "string", format: "date-time" },
      property_title: { type: "string" },
      reference_code: { type: "string" },
      payments: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "amount", "paidOn", "recordedBy", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            amount: { type: "string" },
            paidOn: { type: "string", format: "date" },
            reference: { type: "string", nullable: true },
            recordedBy: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
      adjustment_total: { type: "string" },
      amount_owed: { type: "string" },
      paid_total: { type: "string" },
      outstanding: { type: "string" },
    },
  },

  CommissionStatementResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/CommissionStatement",
      },
    },
  },

  CommissionApprovalResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "object",
        description: "Updated commission record returned by the database.",
        properties: {
          id: { type: "string", format: "uuid" },
          transaction_id: { type: "string", format: "uuid" },
          seller_id: { type: "string", format: "uuid" },
          agreement_id: { type: "string", format: "uuid" },
          sale_amount: { type: "string" },
          commission_rate_pct: { type: "string" },
          platform_share_pct: { type: "string" },
          total_commission: { type: "string" },
          platform_amount: { type: "string" },
          seller_amount: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "approved", "paid"],
          },
          approved_by: { type: "string", format: "uuid", nullable: true },
          approved_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },

  RecordCommissionPaymentRequest: {
    type: "object",
    required: ["amount", "paidOn"],
    properties: {
      amount: {
        type: "string",
        pattern: "^\\d+(\\.\\d{1,2})?$",
        description:
          "Positive monetary amount with at most two decimal places.",
        example: "15000.00",
      },
      paidOn: {
        type: "string",
        format: "date",
        description: "Payment date. It cannot be in the future.",
      },
      reference: {
        type: "string",
        minLength: 1,
        description: "Optional payment reference.",
      },
    },
    additionalProperties: false,
    example: {
      amount: "15000.00",
      paidOn: "2026-11-18",
      reference: "BANK-TRANSFER-001",
    },
  },

  CommissionPaymentResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "object",
        required: ["payment", "amountOwed", "paidTotal", "outstanding"],
        properties: {
          payment: {
            $ref: "#/components/schemas/CommissionPaymentRecord",
          },
          amountOwed: { type: "string" },
          paidTotal: { type: "string" },
          outstanding: { type: "string" },
        },
      },
    },
  },

  CreateCommissionAdjustmentRequest: {
    type: "object",
    required: ["amount", "reason"],
    properties: {
      amount: {
        type: "string",
        pattern: "^-?\\d+(\\.\\d{1,2})?$",
        description:
          "Non-zero positive or negative adjustment amount with at most two decimal places.",
        example: "-500.00",
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 4000,
      },
    },
    additionalProperties: false,
    example: {
      amount: "-500.00",
      reason: "Correction to the previously calculated commission.",
    },
  },

  CommissionAdjustmentResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "object",
        required: [
          "id",
          "commission_id",
          "amount",
          "reason",
          "created_by",
          "created_at",
          "amountOwed",
          "notificationSent",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          commission_id: { type: "string", format: "uuid" },
          amount: { type: "string" },
          reason: { type: "string" },
          created_by: { type: "string", format: "uuid" },
          created_at: { type: "string", format: "date-time" },
          amountOwed: { type: "string" },
          notificationSent: { type: "boolean" },
        },
      },
    },
  },
} as const;
