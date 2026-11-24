import { jsonResponse, sharedSchemas } from "./shared";
import { authPaths, authSchemas } from "./auth.docs";
import { accountPaths, accountSchemas } from "./accounts.docs";
import { projectPaths, projectSchemas } from "./projects.docs";
import { propertyPaths, propertySchemas } from "./properties.docs";
import { referralPaths, referralSchemas } from "./referrals.docs";
import { favoritePaths, favoriteSchemas } from "./favorites.docs";
import {
  referralIssuePaths,
  referralIssueSchemas,
} from "./referralIssues.docs";

import {
  referralOperationsPaths,
  referralOperationsSchemas,
} from "./referralOperations.docs";

import { transactionPaths, transactionSchemas } from "./transactions.docs";

import {
  commissionManagementPaths,
  commissionManagementSchemas,
} from "./commissionManagement.docs";
import { disputePaths, disputeSchemas } from "./disputes.docs";
import { notificationPaths, notificationSchemas } from "./notifications.docs";
import { reportPaths, reportSchemas } from "./reports.docs";
import { adminPaths, adminSchemas } from "./admin.docs";

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Sola Properties API",
    version: "1.0.0",
    description:
      "Authentication, account verification, profile management, buyer preferences, and health endpoints.",
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
    { name: "Profiles", description: "Role-specific profile management" },
    {
      name: "Account Verification",
      description:
        "Agent and developer verification applications and admin review",
    },
    {
      name: "Projects",
      description: "Developer project management and admin project actions",
    },
    {
      name: "Properties",
      description: "Public property discovery and property-owner management",
    },
    {
      name: "Property Authorization",
      description:
        "Developer-agent authorization and authorized-property operations.",
    },
    {
      name: "Referrals",
      description: "Property inquiry and referral management.",
    },
    {
      name: "Favorites",
      description: "Buyer saved properties and favorite management",
    },
    {
      name: "Referral Issues",
      description: "Referral issue reporting and administrative review.",
    },
    {
      name: "Transactions",
      description: "Transaction submission, review, documents, and export.",
    },

    {
      name: "Commission Management",
      description:
        "Commission agreements, commission records, approvals, payments, adjustments, and statements.",
    },

    {
      name: "Disputes",
      description:
        "Transaction and commission dispute submission, review, and decisions.",
    },

    {
      name: "Notifications",
      description: "User notifications and read-status management.",
    },
    {
      name: "Reports",
      description: "Role-based dashboards and platform reporting.",
    },

    {
      name: "Admin",
      description:
        "Administrative user management, audit logs, and property lookup management.",
    },
    { name: "System", description: "API health" },
  ],
  paths: {
    "/": {
      get: {
        tags: ["System"],
        summary: "Check API health",
        operationId: "healthCheck",
        responses: {
          "200": jsonResponse("API is running", "HealthResponse"),
        },
      },
    },
    ...authPaths,
    ...accountPaths,
    ...projectPaths,
    ...propertyPaths,
    ...referralPaths,
    ...favoritePaths,
    ...referralIssuePaths,
    ...referralOperationsPaths,
    ...transactionPaths,
    ...commissionManagementPaths,
    ...disputePaths,
    ...notificationPaths,
    ...reportPaths,
    ...adminPaths,
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
      ...sharedSchemas,
      ...authSchemas,
      ...accountSchemas,
      ...projectSchemas,
      ...propertySchemas,
      ...referralSchemas,
      ...favoriteSchemas,
      ...referralIssueSchemas,
      ...referralOperationsSchemas,
      ...transactionSchemas,
      ...commissionManagementSchemas,
      ...disputeSchemas,
      ...notificationSchemas,
      ...reportSchemas,
      ...adminSchemas,
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
