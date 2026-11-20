import { error, jsonBody, jsonResponse } from "./shared";

export const propertyPaths = {
  "/api/v1/properties": {
    get: {
      tags: ["Properties"],
      summary: "List public properties",
      operationId: "listPublicProperties",
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: "q",
          in: "query",
          description: "Search query",
          schema: { type: "string", maxLength: 200 },
        },
        {
          name: "location_id",
          in: "query",
          description: "Filter by property location UUID",
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "category_ids",
          in: "query",
          description: "Comma-separated property category UUIDs (maximum 10)",
          style: "form",
          explode: false,
          schema: {
            type: "array",
            maxItems: 10,
            items: { type: "string", format: "uuid" },
          },
        },
        {
          name: "features",
          in: "query",
          description: "Comma-separated property features",
          schema: { type: "string" },
        },
        {
          name: "price_min",
          in: "query",
          schema: { type: "number", minimum: 0 },
        },
        {
          name: "price_max",
          in: "query",
          schema: { type: "number", minimum: 0 },
        },
        {
          name: "min_size_sqm",
          in: "query",
          schema: { type: "number", exclusiveMinimum: 0 },
        },
        {
          name: "min_bedrooms",
          in: "query",
          schema: { type: "integer", minimum: 0 },
        },
        {
          name: "payment_plan",
          in: "query",
          schema: {
            type: "string",
            description: "Allowed payment preference from the API constants",
          },
        },
        {
          name: "sort",
          in: "query",
          schema: {
            type: "string",
            enum: [
              "newest",
              "price_asc",
              "price_desc",
              "location",
              "relevance",
            ],
            default: "newest",
          },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Public property results",
          "PublicPropertyListResponse",
        ),
        "400": error("Invalid property filters"),
        "500": error("Unexpected server error"),
      },
    },
    post: {
      tags: ["Properties"],
      summary: "Create a property",
      operationId: "createProperty",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("CreatePropertyRequest"),
      responses: {
        "201": jsonResponse(
          "Property created and submitted for approval",
          "PropertyResponse",
        ),
        "400": error("Invalid property data"),
        "401": error("Authentication is required"),
        "403": error("Only agents and developers can create properties"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/compare": {
    get: {
      tags: ["Properties"],
      summary: "Compare public properties",
      operationId: "compareProperties",
      parameters: [
        {
          name: "ids",
          in: "query",
          required: true,
          description: "Comma-separated UUIDs of 2–4 properties",
          schema: { type: "string", example: "uuid-1,uuid-2" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Properties to compare",
          "PropertyComparisonResponse",
        ),
        "400": error("Provide 2–4 unique, valid property IDs"),
        "404": error(
          "One or more properties were not found or are unavailable",
        ),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/recommended": {
    get: {
      tags: ["Properties"],
      summary: "Get recommended properties",
      operationId: "getRecommendedProperties",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Recommended properties for the buyer",
          "RecommendedPropertiesResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("An approved buyer account is required"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/me": {
    get: {
      tags: ["Properties"],
      summary: "List the authenticated owner's properties",
      operationId: "getMyProperties",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: [
              "draft",
              "pending_approval",
              "active",
              "inactive",
              "sold",
              "rejected",
            ],
          },
        },
      ],
      responses: {
        "200": jsonResponse("Owner's property list", "MyPropertyListResponse"),
        "400": error("Invalid property query"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/me/{propertyId}": {
    get: {
      tags: ["Properties"],
      summary: "Get one of the authenticated owner's properties",
      operationId: "getMyProperty",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse("Owner's property details", "PropertyResponse"),
        "400": error("Invalid property ID"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "404": error("Property not found"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/{propertyId}": {
    get: {
      tags: ["Properties"],
      summary: "Get public property details",
      operationId: "getPublicProperty",
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse("Public property details", "PropertyResponse"),
        "400": error("Invalid property ID"),
        "404": error("Property not found"),
        "500": error("Unexpected server error"),
      },
    },
    patch: {
      tags: ["Properties"],
      summary: "Update an owner's property",
      operationId: "updateProperty",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: jsonBody("UpdatePropertyRequest"),
      responses: {
        "200": jsonResponse("Property updated", "PropertyResponse"),
        "400": error("Invalid property ID or update data"),
        "401": error("Authentication is required"),
        "403": error("Role or project association is not allowed"),
        "404": error("Property or project not found"),
        "409": error("Property is not editable"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/{propertyId}/status": {
    patch: {
      tags: ["Properties"],
      summary: "Change an owner's property status",
      operationId: "updatePropertyStatus",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: jsonBody("UpdatePropertyStatusRequest"),
      responses: {
        "200": jsonResponse("Property status updated", "PropertyResponse"),
        "400": error("Invalid property ID or status"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "404": error("Property not found"),
        "409": error("Invalid property status transition"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/{propertyId}/images": {
    post: {
      tags: ["Properties"],
      summary: "Upload property images",
      operationId: "uploadPropertyImages",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              $ref: "#/components/schemas/UploadPropertyImagesRequest",
            },
          },
        },
      },
      responses: {
        "201": jsonResponse("Images uploaded", "PropertyImagesResponse"),
        "400": error("Invalid property ID or no images supplied"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "404": error("Property not found"),
        "409": error("Images are locked or the image limit was reached"),
        "500": error("Unexpected server error"),
      },
    },
    get: {
      tags: ["Properties"],
      summary: "List images for an owner's property",
      operationId: "getPropertyImages",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Property images with signed URLs",
          "PropertyImagesResponse",
        ),
        "400": error("Invalid property ID"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "404": error("Property not found"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/{propertyId}/images/{imageId}": {
    delete: {
      tags: ["Properties"],
      summary: "Delete an image from an owner's property",
      operationId: "deletePropertyImage",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "imageId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Image deleted; cleanup status returned",
          "DeletePropertyImageResponse",
        ),
        "400": error("Invalid property ID or image ID"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "404": error("Property or image not found"),
        "409": error("Images cannot be changed for this property's status"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/properties/{propertyId}/history": {
    get: {
      tags: ["Properties"],
      summary: "Get an owner's property history",
      operationId: "getMyPropertyHistory",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Property audit history",
          "PropertyHistoryResponse",
        ),
        "400": error("Invalid property ID"),
        "401": error("Authentication is required"),
        "403": error("An approved agent or developer account is required"),
        "404": error("Property not found"),
        "500": error("Unexpected server error"),
      },
    },
  },
  "/api/v1/developer/agents": {
    get: {
      tags: ["Property Authorization"],
      summary: "List approved agents",
      description:
        "Returns approved, email-verified agents. Developers can search by agent name or agency and paginate results.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100 },
        },
        {
          name: "search",
          in: "query",
          required: false,
          schema: { type: "string", maxLength: 100 },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Approved agents retrieved successfully.",
          "ApprovedAgentsResponse",
        ),
        "400": error("Invalid query parameters."),
        "401": error("Authentication required."),
        "403": error("Developer role or approved account required."),
        "500": error("Internal server error."),
      },
    },
  },
  "/api/v1/developer/agents/{agentId}": {
    get: {
      tags: ["Property Authorization"],
      summary: "Get approved agent details",
      description: "Returns details for an approved, email-verified agent.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "agentId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Agent details retrieved successfully.",
          "ApprovedAgentResponse",
        ),
        "400": error("Invalid agent ID."),
        "401": error("Authentication required."),
        "403": error("Developer role or approved account required."),
        "404": error("Approved agent not found."),
        "500": error("Internal server error."),
      },
    },
  },
  "/api/v1/developer/properties/{propertyId}/agents": {
    post: {
      tags: ["Property Authorization"],
      summary: "Authorize an agent for a property",
      description:
        "Authorizes an approved, email-verified agent to market an active property owned by the authenticated developer. A previously revoked authorization can be reactivated.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: jsonBody("AuthorizeAgentRequest"),
      responses: {
        "200": jsonResponse(
          "Agent authorization created or reactivated.",
          "PropertyAuthorizationResponse",
        ),
        "400": error("Invalid IDs or self-authorization attempted."),
        "401": error("Authentication required."),
        "403": error("Developer role or approved account required."),
        "404": error("Property or approved agent not found."),
        "409": error("Property is not active or agent is already authorized."),
        "500": error("Internal server error."),
      },
    },
    get: {
      tags: ["Property Authorization"],
      summary: "List agents authorized for a property",
      description:
        "Returns agents authorized for a property owned by the authenticated developer. Results can be filtered by authorization status and searched by agent name or agency.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100 },
        },
        {
          name: "search",
          in: "query",
          required: false,
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["active", "revoked"] },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Authorized agents retrieved successfully.",
          "AuthorizedAgentsResponse",
        ),
        "400": error("Invalid path or query parameters."),
        "401": error("Authentication required."),
        "403": error("Developer role or approved account required."),
        "404": error("Property not found."),
        "500": error("Internal server error."),
      },
    },
  },
  "/api/v1/developer/properties/{propertyId}/agents/{agentId}": {
    patch: {
      tags: ["Property Authorization"],
      summary: "Revoke an agent's property authorization",
      description:
        "Revokes an existing authorization for a property owned by the authenticated developer.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "agentId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Authorization revoked successfully.",
          "PropertyAuthorizationResponse",
        ),
        "400": error("Invalid path parameters."),
        "401": error("Authentication required."),
        "403": error("Developer role or approved account required."),
        "404": error("Property or authorization not found."),
        "409": error("Authorization has already been revoked."),
        "500": error("Internal server error."),
      },
    },
  },
  "/api/v1/agent/authorized-properties": {
    get: {
      tags: ["Property Authorization"],
      summary: "List properties authorized for the agent",
      description:
        "Returns active properties for which the authenticated agent has an active authorization. Supports pagination, text search, and category/location UUID filtering.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100 },
        },
        {
          name: "search",
          in: "query",
          required: false,
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "location_id",
          in: "query",
          required: false,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "category_id",
          in: "query",
          required: false,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(
          "Authorized properties retrieved successfully.",
          "AgentAuthorizedPropertiesResponse",
        ),
        "400": error("Invalid query parameters."),
        "401": error("Authentication required."),
        "403": error("Agent role or approved account required."),
        "500": error("Internal server error."),
      },
    },
  },
  "/api/v1/admin/properties": {
    get: {
      tags: ["Properties"],
      summary: "List pending properties for admin review",
      description:
        "Returns pending_approval properties ordered by creation time, oldest first. Requires the admin role.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, default: 1 },
          description: "Page number.",
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
          description: "Number of properties per page.",
        },
      ],
      responses: {
        "200": {
          description: "Pending properties retrieved successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items", "page", "limit", "total"],
                properties: {
                  items: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Property" },
                  },
                  page: { type: "integer" },
                  limit: { type: "integer" },
                  total: { type: "integer", minimum: 0 },
                },
              },
            },
          },
        },
        "400": error("Invalid pagination parameters."),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("The authenticated user does not have the admin role."),
      },
    },
  },
  "/api/v1/admin/properties/{propertyId}": {
    parameters: [
      {
        name: "propertyId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "ID of the pending property.",
      },
    ],
    get: {
      tags: ["Properties"],
      summary: "Get a pending property for admin review",
      description:
        "Returns a single property only if its status is pending_approval. Requires the admin role.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Pending property retrieved successfully.",
          "AdminPendingPropertyResponse",
        ),
        "400": error(
          "Invalid property ID (INVALID_PROPERTY_ID), or invalid request data.",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("The authenticated user does not have the admin role."),
        "404": error(
          "Pending property not found (PENDING_PROPERTY_NOT_FOUND).",
        ),
      },
    },
  },
  "/api/v1/admin/properties/{propertyId}/decision": {
    parameters: [
      {
        name: "propertyId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "ID of the property to review.",
      },
    ],
    patch: {
      tags: ["Properties"],
      summary: "Approve or reject a property",
      description:
        "Approves a pending property by setting its status to active, or rejects it by setting its status to rejected. Rejection requires a reason. The decision and audit record are saved in a transaction. Requires the admin role.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("AdminPropertyDecisionRequest"),
      responses: {
        "200": jsonResponse(
          "Property status applied successfully.",
          "AdminPendingPropertyResponse",
        ),
        "400": error(
          "Invalid property ID (INVALID_PROPERTY_ID), invalid decision body (VALIDATION_ERROR).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "403": error("The authenticated user does not have the admin role."),
        "404": error("Property not found (PROPERTY_NOT_FOUND)."),
        "409": error(
          "Only pending properties can be approved or rejected (PROPERTY_NOT_PENDING).",
        ),
      },
    },
  },

  "/api/v1/properties/categories": {
    get: {
      tags: ["Properties"],
      summary: "List available property categories",
      operationId: "listPropertyCategories",
      description:
        "Returns all active property categories available for property selection.",
      responses: {
        "200": jsonResponse(
          "Property categories retrieved successfully",
          "PropertyLookupsResponse",
        ),
        "500": error("Unexpected server error"),
      },
    },
  },

  "/api/v1/properties/locations": {
    get: {
      tags: ["Properties"],
      summary: "List available property locations",
      operationId: "listPropertyLocations",
      description:
        "Returns all active property locations available for property selection.",
      responses: {
        "200": jsonResponse(
          "Property locations retrieved successfully",
          "PropertyLookupsResponse",
        ),
        "500": error("Unexpected server error"),
      },
    },
  },
} as const;

export const propertySchemas = {
  Property: {
    type: "object",
    required: [
      "id",
      "owner_id",
      "title",
      "category_id",
      "location_id",
      "features",
      "status",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      owner_id: { type: "string", format: "uuid" },
      project_id: { type: "string", format: "uuid", nullable: true },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      category_id: { type: "string", format: "uuid" },
      location_id: { type: "string", format: "uuid" },
      category_name: { type: "string" },
      location_name: { type: "string" },
      size_sqm: { type: "number", nullable: true },
      bedrooms: { type: "integer", nullable: true },
      bathrooms: { type: "integer", nullable: true },
      features: { type: "array", items: { type: "string" } },
      price: { type: "number", nullable: true },
      payment_plan: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: [
          "draft",
          "pending_approval",
          "active",
          "inactive",
          "sold",
          "rejected",
        ],
      },
      rejection_reason: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  PropertyResponse: {
    type: "object",
    required: ["property"],
    properties: {
      property: { $ref: "#/components/schemas/Property" },
    },
  },
  CreatePropertyRequest: {
    type: "object",
    additionalProperties: false,
    required: ["title", "category_id", "location_id", "price", "payment_plan"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", maxLength: 10000, nullable: true },
      category_id: {
        type: "string",
        format: "uuid",
        description: "UUID of an existing property category",
      },
      location_id: {
        type: "string",
        format: "uuid",
        description: "UUID of an existing property location",
      },
      size_sqm: { type: "number", exclusiveMinimum: 0, nullable: true },
      bedrooms: { type: "integer", minimum: 0, nullable: true },
      bathrooms: { type: "integer", minimum: 0, nullable: true },
      features: { type: "array", maxItems: 20, items: { type: "string" } },
      price: { type: "number", exclusiveMinimum: 0 },
      payment_plan: {
        type: "string",
        description: "A value accepted by PAYMENT_PREFERENCES",
      },
      project_id: { type: "string", format: "uuid", nullable: true },
    },
  },
  UpdatePropertyRequest: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", maxLength: 10000, nullable: true },
      category_id: {
        type: "string",
        format: "uuid",
        description: "UUID of an active property category",
      },
      location_id: {
        type: "string",
        format: "uuid",
        description: "UUID of an active property location",
      },
      size_sqm: { type: "number", exclusiveMinimum: 0, nullable: true },
      bedrooms: { type: "integer", minimum: 0, nullable: true },
      bathrooms: { type: "integer", minimum: 0, nullable: true },
      features: { type: "array", maxItems: 20, items: { type: "string" } },
      price: { type: "number", exclusiveMinimum: 0 },
      payment_plan: {
        type: "string",
        description: "A value accepted by PAYMENT_PREFERENCES",
      },
      project_id: { type: "string", format: "uuid", nullable: true },
    },
  },
  UpdatePropertyStatusRequest: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["inactive", "sold"] },
    },
  },
  MyPropertyListResponse: {
    type: "object",
    required: ["items", "page", "limit", "total"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/Property" },
      },
      page: { type: "integer" },
      limit: { type: "integer" },
      total: { type: "integer" },
    },
  },
  PublicPropertyListResponse: {
    type: "object",
    required: ["items", "page", "limit", "total"],
    properties: {
      items: {
        type: "array",
        items: {
          allOf: [
            { $ref: "#/components/schemas/Property" },
            {
              type: "object",
              properties: {
                possible_duplicate: { type: "boolean" },
                possible_duplicate_count: { type: "integer" },
              },
            },
          ],
        },
      },
      page: { type: "integer" },
      limit: { type: "integer" },
      total: { type: "integer" },
    },
  },
  PropertyComparisonResponse: {
    type: "object",
    required: ["properties"],
    properties: {
      properties: {
        type: "array",
        items: { $ref: "#/components/schemas/Property" },
      },
    },
  },
  RecommendedPropertiesResponse: {
    type: "object",
    required: ["properties"],
    properties: {
      properties: {
        type: "array",
        items: {
          allOf: [
            { $ref: "#/components/schemas/Property" },
            {
              type: "object",
              properties: {
                match_score: { type: "number" },
              },
            },
          ],
        },
      },
    },
  },
  UploadPropertyImagesRequest: {
    type: "object",
    required: ["images"],
    properties: {
      images: {
        type: "array",
        maxItems: 10,
        items: { type: "string", format: "binary" },
        description: "JPEG, PNG, or WebP image files",
      },
    },
  },
  PropertyImage: {
    type: "object",
    required: [
      "id",
      "property_id",
      "original_filename",
      "mime_type",
      "file_size",
      "is_primary",
      "display_order",
      "created_at",
      "url",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      property_id: { type: "string", format: "uuid" },
      original_filename: { type: "string" },
      mime_type: {
        type: "string",
        enum: ["image/jpeg", "image/png", "image/webp"],
      },
      file_size: { type: "integer" },
      is_primary: { type: "boolean" },
      display_order: { type: "integer" },
      created_at: { type: "string", format: "date-time" },
      url: {
        type: "string",
        format: "uri",
        description: "Signed image URL",
      },
    },
  },
  PropertyImagesResponse: {
    type: "object",
    required: ["images"],
    properties: {
      images: {
        type: "array",
        items: { $ref: "#/components/schemas/PropertyImage" },
      },
    },
  },
  DeletePropertyImageResponse: {
    type: "object",
    required: ["deleted", "cleanupPending"],
    properties: {
      deleted: { type: "boolean", enum: [true] },
      cleanupPending: { type: "boolean" },
    },
  },
  PropertyHistoryResponse: {
    type: "object",
    required: ["message", "data"],
    properties: {
      message: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            actor_id: { type: "string", format: "uuid", nullable: true },
            action: { type: "string" },
            old_values: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            new_values: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  AuthorizeAgentRequest: {
    type: "object",
    required: ["agentId"],
    properties: {
      agentId: {
        type: "string",
        format: "uuid",
        description: "ID of the approved agent to authorize.",
      },
    },
  },

  PropertyAuthorization: {
    type: "object",
    required: [
      "id",
      "property_id",
      "agent_id",
      "authorized_by",
      "status",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      property_id: { type: "string", format: "uuid" },
      agent_id: { type: "string", format: "uuid" },
      authorized_by: { type: "string", format: "uuid" },
      status: { type: "string", enum: ["active", "revoked"] },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },

  PropertyAuthorizationResponse: {
    type: "object",
    required: ["message", "authorization"],
    properties: {
      message: { type: "string" },
      authorization: {
        $ref: "#/components/schemas/PropertyAuthorization",
      },
    },
  },

  AgentSummary: {
    type: "object",
    required: ["id", "full_name", "status", "agency_name"],
    properties: {
      id: { type: "string", format: "uuid" },
      full_name: { type: "string" },
      status: { type: "string" },
      agency_name: { type: "string", nullable: true },
      bio: { type: "string", nullable: true },
      years_of_experience: { type: "integer", nullable: true },
      authorization_status: {
        type: "string",
        enum: ["active", "revoked"],
      },
      authorized_at: { type: "string", format: "date-time" },
    },
  },

  Pagination: {
    type: "object",
    required: ["page", "limit", "total"],
    properties: {
      page: { type: "integer" },
      limit: { type: "integer" },
      total: { type: "integer" },
    },
  },

  ApprovedAgentsResponse: {
    type: "object",
    required: ["items", "pagination"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/AgentSummary" },
      },
      pagination: { $ref: "#/components/schemas/Pagination" },
    },
  },

  ApprovedAgentResponse: {
    type: "object",
    required: ["agent"],
    properties: {
      agent: { $ref: "#/components/schemas/AgentSummary" },
    },
  },

  AuthorizedAgentsResponse: {
    type: "object",
    required: ["items", "pagination"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/AgentSummary" },
      },
      pagination: { $ref: "#/components/schemas/Pagination" },
    },
  },

  AuthorizedProperty: {
    type: "object",
    required: [
      "id",
      "title",
      "description",
      "category_id",
      "location_id",
      "size_sqm",
      "bedrooms",
      "bathrooms",
      "price",
      "payment_plan",
      "status",
      "project_id",
      "authorized_at",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      category_id: { type: "string", format: "uuid" },
      location_id: { type: "string", format: "uuid" },
      category_name: { type: "string" },
      location_name: { type: "string" },
      size_sqm: { type: "number", nullable: true },
      bedrooms: { type: "integer", nullable: true },
      bathrooms: { type: "integer", nullable: true },
      price: { type: "number", nullable: true },
      payment_plan: { type: "string", nullable: true },
      status: { type: "string" },
      project_id: { type: "string", format: "uuid", nullable: true },
      authorized_at: { type: "string", format: "date-time" },
    },
  },

  AgentAuthorizedPropertiesResponse: {
    type: "object",
    required: ["items", "pagination"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/AuthorizedProperty" },
      },
      pagination: { $ref: "#/components/schemas/Pagination" },
    },
  },

  AdminPendingPropertyResponse: {
    type: "object",
    required: ["property"],
    properties: {
      property: {
        $ref: "#/components/schemas/Property",
      },
    },
  },

  AdminPropertyDecisionRequest: {
    type: "object",
    additionalProperties: false,
    required: ["decision"],
    properties: {
      decision: {
        type: "string",
        enum: ["approve", "reject"],
        description: "Decision to apply to the pending property.",
      },
      rejection_reason: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
        description:
          "Required when decision is reject. Leading and trailing whitespace is trimmed before validation.",
      },
    },
    description:
      "When decision is reject, rejection_reason must be provided and must contain at least one non-whitespace character.",
  },

  DeveloperProjectProperty: {
    allOf: [
      { $ref: "#/components/schemas/Property" },
      {
        type: "object",
        properties: {
          category_name: { type: "string" },
          location_name: { type: "string" },
        },
      },
    ],
  },

  DeveloperProjectPropertiesResponse: {
    type: "object",
    required: ["message", "result"],
    properties: {
      message: {
        type: "string",
        example: "Project properties retrieved successfully",
      },
      result: {
        type: "object",
        required: ["items", "page", "limit", "total", "totalPages"],
        properties: {
          items: {
            type: "array",
            items: {
              $ref: "#/components/schemas/DeveloperProjectProperty",
            },
          },
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  },

  PropertyLookup: {
    type: "object",
    required: ["id", "name", "isActive", "createdAt", "updatedAt"],
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  PropertyLookupsResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/PropertyLookup" },
      },
    },
  },
} as const;
