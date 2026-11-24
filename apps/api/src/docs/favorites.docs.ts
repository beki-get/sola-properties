import { error, jsonBody, jsonResponse } from "./shared";

export const favoritePaths = {
  "/api/v1/favorites": {
    post: {
      tags: ["Favorites"],
      summary: "Add a property to favorites",
      operationId: "addFavorite",
      description:
        "Adds an active property to the authenticated buyer's favorites. Only approved buyer accounts can use this endpoint. A property can only be favorited once by the same buyer.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("AddFavoriteRequest"),
      responses: {
        "201": jsonResponse(
          "Property added to favorites successfully",
          "AddFavoriteResponse",
        ),
        "400": jsonResponse(
          "Invalid request data",
          "FavoriteValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Buyer role and an approved account are required"),
        "404": error("Property not found"),
        "409": error(
          "Property is not active or has already been added to favorites",
        ),
        "500": error("An unexpected error occurred"),
      },
    },

    get: {
      tags: ["Favorites"],
      summary: "Get my favorite properties",
      operationId: "getBuyerFavorites",
      description:
        "Returns the authenticated buyer's favorited properties, including property details, category and location names, images, and pagination information. Results are ordered by favorite creation time, newest first.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "page",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Page number.",
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 10,
          },
          description: "Number of favorites per page.",
        },
      ],
      responses: {
        "200": jsonResponse(
          "Favorite properties retrieved successfully",
          "BuyerFavoritesResponse",
        ),
        "400": jsonResponse(
          "Invalid pagination parameters",
          "FavoriteValidationErrorResponse",
        ),
        "401": error("Authentication is required"),
        "403": error("Buyer role and an approved account are required"),
        "500": error("An unexpected error occurred"),
      },
    },
  },

  "/api/v1/favorites/{propertyId}": {
    delete: {
      tags: ["Favorites"],
      summary: "Remove a property from favorites",
      operationId: "removeFavorite",
      description:
        "Removes a property from the authenticated buyer's favorites. Buyers can only remove their own favorites.",
      security: [{ AccessToken: [] }],
      parameters: [
        {
          name: "propertyId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "ID of the property to remove from favorites.",
        },
      ],
      responses: {
        "200": jsonResponse(
          "Favorite removed successfully",
          "MessageResponse",
        ),
        "400": error("Invalid property ID"),
        "401": error("Authentication is required"),
        "403": error("Buyer role and an approved account are required"),
        "404": error("Favorite not found"),
        "500": error("An unexpected error occurred"),
      },
    },
  },
} as const;

export const favoriteSchemas = {
  AddFavoriteRequest: {
    type: "object",
    required: ["propertyId"],
    properties: {
      propertyId: {
        type: "string",
        format: "uuid",
        description: "ID of the property to add to favorites.",
      },
    },
  },

  Favorite: {
    type: "object",
    required: ["id", "property_id", "created_at"],
    properties: {
      id: { type: "string", format: "uuid" },
      property_id: { type: "string", format: "uuid" },
      created_at: { type: "string", format: "date-time" },
    },
  },

  AddFavoriteResponse: {
    type: "object",
    required: ["message", "favorite"],
    properties: {
      message: {
        type: "string",
        example: "Property added to favorites successfully",
      },
      favorite: {
        $ref: "#/components/schemas/Favorite",
      },
    },
  },

  FavoritePropertyImage: {
    type: "object",
    required: [
      "id",
      "storage_key",
      "original_filename",
      "mime_type",
      "file_size",
      "is_primary",
      "display_order",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      storage_key: { type: "string" },
      original_filename: { type: "string" },
      mime_type: {
        type: "string",
        enum: ["image/jpeg", "image/png", "image/webp"],
      },
      file_size: { type: "integer" },
      is_primary: { type: "boolean" },
      display_order: { type: "integer" },
    },
  },

  FavoriteProperty: {
    type: "object",
    required: [
      "favorite_id",
      "favorited_at",
      "property_id",
      "title",
      "category_id",
      "location_id",
      "category_name",
      "location_name",
      "features",
      "property_status",
      "property_created_at",
      "images",
    ],
    properties: {
      favorite_id: { type: "string", format: "uuid" },
      favorited_at: { type: "string", format: "date-time" },
      property_id: { type: "string", format: "uuid" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      category_id: { type: "string", format: "uuid" },
      location_id: { type: "string", format: "uuid" },
      category_name: { type: "string" },
      location_name: { type: "string" },
      size_sqm: { type: "number", nullable: true },
      bedrooms: { type: "integer", nullable: true },
      bathrooms: { type: "integer", nullable: true },
      features: {
        type: "array",
        items: { type: "string" },
      },
      price: { type: "number", nullable: true },
      payment_plan: { type: "string", nullable: true },
      property_status: {
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
      property_created_at: { type: "string", format: "date-time" },
      images: {
        type: "array",
        items: {
          $ref: "#/components/schemas/FavoritePropertyImage",
        },
      },
    },
  },

  BuyerFavoritesResponse: {
    type: "object",
    required: ["favorites", "pagination"],
    properties: {
      favorites: {
        type: "array",
        items: {
          $ref: "#/components/schemas/FavoriteProperty",
        },
      },
      pagination: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  },

  FavoriteValidationErrorResponse: {
    type: "object",
    required: ["message", "errors"],
    properties: {
      message: { type: "string" },
      errors: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
} as const;