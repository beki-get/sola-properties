
import { error, jsonResponse } from "./shared";

export const reportPaths = {
  "/api/v1/reports/agent": {
    get: {
      tags: ["Reports"],
      summary: "Get the agent dashboard report",
      operationId: "getAgentReport",
      description:
        "Returns reporting data for the authenticated agent, including owned property statistics, assigned referral statistics, verified sales, commission balances, and properties authorized to the agent.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Agent report retrieved successfully.",
          "AgentReportResponse",
        ),
        "401": error("Authentication required (AUTH_REQUIRED)."),
        "403": error("The account is not approved or the user does not have the agent role."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/reports/developer": {
    get: {
      tags: ["Reports"],
      summary: "Get the developer dashboard report",
      operationId: "getDeveloperReport",
      description:
        "Returns reporting data for the authenticated developer, including total projects, owned properties, authorized agents, and referrals assigned to the developer.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Developer report retrieved successfully.",
          "DeveloperReportResponse",
        ),
        "401": error("Authentication required (AUTH_REQUIRED)."),
        "403": error("The account is not approved or the user does not have the developer role."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/reports/admin": {
    get: {
      tags: ["Reports"],
      summary: "Get the administrator dashboard report",
      operationId: "getAdminReport",
      description:
        "Returns platform-wide reporting data, including property and referral statistics, verified sales, commission balances, total users, and pending account-verification requests. Restricted to administrators.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Admin report retrieved successfully.",
          "AdminReportResponse",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("The account is not approved or the user does not have the admin role."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/reports/finance-admin": {
    get: {
      tags: ["Reports"],
      summary: "Get the finance administrator report",
      operationId: "getFinanceAdminReport",
      description:
        "Returns platform-wide verified sales and commission reporting data, including total commissions, seller earnings, adjustments, payments, and outstanding amounts. Restricted to finance administrators.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Finance admin report retrieved successfully.",
          "FinanceAdminReportResponse",
        ),
        "401": error("Authentication is required or the access token is invalid."),
        "403": error("The account is not approved or the user does not have the finance_admin role."),
        "500": error("An unexpected server error occurred."),
      },
    },
  },
} as const;


export const reportSchemas = {
  ReportStatusCounts: {
    type: "object",
    description: "A mapping of each status to its record count.",
    additionalProperties: {
      type: "integer",
      minimum: 0,
    },
    example: {
      active: 12,
      pending: 4,
      sold: 3,
    },
  },

  PropertyReportSection: {
    type: "object",
    required: ["total", "byStatus"],
    properties: {
      total: {
        type: "integer",
        minimum: 0,
      },
      byStatus: {
        $ref: "#/components/schemas/ReportStatusCounts",
      },
    },
  },

  ReferralReportSection: {
    type: "object",
    required: ["total", "byStatus"],
    properties: {
      total: {
        type: "integer",
        minimum: 0,
      },
      byStatus: {
        $ref: "#/components/schemas/ReportStatusCounts",
      },
    },
  },

  SalesReportSection: {
    type: "object",
    required: ["totalSalesCount", "totalSalesValue"],
    properties: {
      totalSalesCount: {
        type: "integer",
        minimum: 0,
      },
      totalSalesValue: {
        type: "string",
        description: "Total value of verified sales, represented as a decimal string.",
        example: "12500000.00",
      },
    },
  },

  CommissionReportSection: {
    type: "object",
    required: [
      "totalCommission",
      "sellerEarnings",
      "adjustments",
      "amountPaid",
      "outstandingAmount",
    ],
    properties: {
      totalCommission: { type: "string" },
      sellerEarnings: { type: "string" },
      adjustments: { type: "string" },
      amountPaid: { type: "string" },
      outstandingAmount: { type: "string" },
    },
  },

  AgentReportData: {
    type: "object",
    required: [
      "properties",
      "referrals",
      "sales",
      "commissions",
      "authorizedProperties",
    ],
    properties: {
      properties: {
        $ref: "#/components/schemas/PropertyReportSection",
      },
      referrals: {
        $ref: "#/components/schemas/ReferralReportSection",
      },
      sales: {
        $ref: "#/components/schemas/SalesReportSection",
      },
      commissions: {
        $ref: "#/components/schemas/CommissionReportSection",
      },
      authorizedProperties: {
        type: "object",
        required: ["total"],
        properties: {
          total: { type: "integer", minimum: 0 },
        },
      },
    },
  },

  DeveloperReportData: {
    type: "object",
    required: [
      "totalProjects",
      "totalProperties",
      "authorizedAgents",
      "referrals",
    ],
    properties: {
      totalProjects: {
        type: "integer",
        minimum: 0,
      },
      totalProperties: {
        type: "integer",
        minimum: 0,
      },
      authorizedAgents: {
        type: "integer",
        minimum: 0,
      },
      referrals: {
        $ref: "#/components/schemas/ReferralReportSection",
      },
    },
  },

  AdminReportData: {
    type: "object",
    required: [
      "properties",
      "referrals",
      "sales",
      "commissions",
      "users",
      "pendingVerifications",
    ],
    properties: {
      properties: {
        $ref: "#/components/schemas/PropertyReportSection",
      },
      referrals: {
        $ref: "#/components/schemas/ReferralReportSection",
      },
      sales: {
        $ref: "#/components/schemas/SalesReportSection",
      },
      commissions: {
        $ref: "#/components/schemas/CommissionReportSection",
      },
      users: {
        type: "object",
        required: ["total"],
        properties: {
          total: { type: "integer", minimum: 0 },
        },
      },
      pendingVerifications: {
        type: "object",
        required: ["total"],
        properties: {
          total: { type: "integer", minimum: 0 },
        },
      },
    },
  },

  FinanceAdminReportData: {
    type: "object",
    required: ["sales", "commissions"],
    properties: {
      sales: {
        $ref: "#/components/schemas/SalesReportSection",
      },
      commissions: {
        $ref: "#/components/schemas/CommissionReportSection",
      },
    },
  },

  AgentReportResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/AgentReportData",
      },
    },
  },

  DeveloperReportResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/DeveloperReportData",
      },
    },
  },

  AdminReportResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/AdminReportData",
      },
    },
  },

  FinanceAdminReportResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        $ref: "#/components/schemas/FinanceAdminReportData",
      },
    },
  },
} as const;
