import { error, jsonResponse, jsonBody } from "./shared";

const notificationPaginationParameters = [
  {
    name: "page",
    in: "query",
    required: false,
    schema: {
      type: "integer",
      minimum: 1,
      default: 1,
    },
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
    name: "unreadOnly",
    in: "query",
    required: false,
    description:
      "When true, returns only unread notifications. Defaults to false.",
    schema: {
      type: "string",
      enum: ["true", "false"],
      default: "false",
    },
  },
];

export const notificationPaths = {
  "/api/v1/notifications": {
    get: {
      tags: ["Notifications"],
      summary: "List the current user's notifications",
      operationId: "listNotifications",
      description:
        "Returns paginated notifications belonging to the authenticated user, ordered newest first. The unreadOnly filter can be used to retrieve only unread notifications.",
      security: [{ AccessToken: [] }],
      parameters: notificationPaginationParameters,
      responses: {
        "200": jsonResponse(
          "Notifications retrieved successfully.",
          "NotificationsResponse",
        ),
        "400": error(
          "Invalid notification pagination or filter parameters (INVALID_NOTIFICATION_QUERY).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/notifications/unread-count": {
    get: {
      tags: ["Notifications"],
      summary: "Get the current user's unread notification count",
      operationId: "getUnreadNotificationCount",
      description:
        "Returns the number of unread notifications belonging to the authenticated user.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Unread notification count retrieved successfully.",
          "UnreadNotificationCountResponse",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/notifications/read-all": {
    patch: {
      tags: ["Notifications"],
      summary: "Mark all notifications as read",
      operationId: "markAllNotificationsAsRead",
      description:
        "Marks all unread notifications belonging to the authenticated user as read and returns the number of notifications updated.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "All notifications marked as read.",
          "MarkAllNotificationsAsReadResponse",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/notifications/{notificationId}/read": {
    parameters: [
      {
        name: "notificationId",
        in: "path",
        required: true,
        description: "Unique ID of the notification.",
        schema: {
          type: "string",
          format: "uuid",
        },
      },
    ],
    patch: {
      tags: ["Notifications"],
      summary: "Mark a notification as read",
      operationId: "markNotificationAsRead",
      description:
        "Marks a notification belonging to the authenticated user as read. If the notification is already read, its existing read timestamp is preserved.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Notification marked as read.",
          "MarkNotificationAsReadResponse",
        ),
        "400": error(
          "A valid notification ID is required (INVALID_NOTIFICATION_ID).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "404": error(
          "Notification not found or it does not belong to the authenticated user (NOTIFICATION_NOT_FOUND).",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },

  "/api/v1/notifications/preferences": {
    get: {
      tags: ["Notifications"],
      summary: "Get notification preferences",
      operationId: "getNotificationPreferences",
      description:
        "Returns the authenticated user's preferences for all supported notification types. Notification types without a saved preference are enabled by default.",
      security: [{ AccessToken: [] }],
      responses: {
        "200": jsonResponse(
          "Notification preferences retrieved successfully.",
          "NotificationPreferencesResponse",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },

    patch: {
      tags: ["Notifications"],
      summary: "Update a notification preference",
      operationId: "updateNotificationPreference",
      description:
        "Enables or disables a specific notification type for the authenticated user. The preference is created if it does not already exist, or updated if it does.",
      security: [{ AccessToken: [] }],
      requestBody: jsonBody("UpdateNotificationPreferenceRequest"),
      responses: {
        "200": jsonResponse(
          "Notification preference updated successfully.",
          "NotificationPreferenceMutationResponse",
        ),
        "400": error(
          "A valid notificationType and isEnabled value are required (INVALID_NOTIFICATION_PREFERENCE).",
        ),
        "401": error(
          "Authentication is required or the access token is invalid.",
        ),
        "500": error("An unexpected server error occurred."),
      },
    },
  },
} as const;

export const notificationSchemas = {
  NotificationRecord: {
    type: "object",
    required: [
      "id",
      "recipient_id",
      "type",
      "title",
      "message",
      "entity_type",
      "entity_id",
      "is_read",
      "read_at",
      "created_at",
    ],
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
      recipient_id: {
        type: "string",
        format: "uuid",
      },
      type: {
        type: "string",
        description: "Notification type.",
      },
      title: {
        type: "string",
      },
      message: {
        type: "string",
      },
      entity_type: {
        type: "string",
        nullable: true,
      },
      entity_id: {
        type: "string",
        format: "uuid",
        nullable: true,
      },
      is_read: {
        type: "boolean",
      },
      read_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      created_at: {
        type: "string",
        format: "date-time",
      },
    },
  },

  NotificationsResponse: {
    type: "object",
    required: ["message", "items", "page", "limit", "total"],
    properties: {
      message: {
        type: "string",
      },
      items: {
        type: "array",
        items: {
          $ref: "#/components/schemas/NotificationRecord",
        },
      },
      page: {
        type: "integer",
        minimum: 1,
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
      },
      total: {
        type: "integer",
        minimum: 0,
      },
    },
  },

  UnreadNotificationCountResponse: {
    type: "object",
    required: ["unreadCount"],
    properties: {
      unreadCount: {
        type: "integer",
        minimum: 0,
      },
    },
    example: {
      unreadCount: 5,
    },
  },

  MarkNotificationAsReadResponse: {
    type: "object",
    required: ["message", "notification"],
    properties: {
      message: {
        type: "string",
      },
      notification: {
        $ref: "#/components/schemas/NotificationRecord",
      },
    },
  },

  MarkAllNotificationsAsReadResponse: {
    type: "object",
    required: ["message", "updatedCount"],
    properties: {
      message: {
        type: "string",
      },
      updatedCount: {
        type: "integer",
        minimum: 0,
        description: "Number of unread notifications marked as read.",
      },
    },
    example: {
      message: "All notifications marked as read.",
      updatedCount: 5,
    },
  },

  UpdateNotificationPreferenceRequest: {
    type: "object",
    required: ["notificationType", "isEnabled"],
    properties: {
      notificationType: {
        type: "string",
        enum: [
          "commission_approved",
          "commission_payment_recorded",
          "commission_adjustment",
          "commission_dispute_opened",
          "referral_created",
          "referral_accepted",
          "referral_rejected",
          "referral_reassigned",
          "referral_status_changed",
          "property_price_decreased",
          "property_status_changed",
          "referral_message_received",
          "property_visit_requested",
          "property_visit_scheduled",
          "property_visit_updated",
          "property_visit_cancelled",
          "transaction_status_changed",
          "account_verification_approved",
          "account_verification_rejected",
          "account_status_changed",
          "property_agent_authorized",
          "property_agent_authorization_revoked",
        ],
        description: "Notification type whose preference should be updated.",
      },
      isEnabled: {
        type: "boolean",
        description: "Whether notifications of this type are enabled.",
      },
    },
    additionalProperties: false,
    example: {
      notificationType: "commission_approved",
      isEnabled: false,
    },
  },

  NotificationPreferenceItem: {
    type: "object",
    required: ["notificationType", "isEnabled"],
    properties: {
      notificationType: {
        type: "string",
        enum: [
          "commission_approved",
          "commission_payment_recorded",
          "commission_adjustment",
          "commission_dispute_opened",
          "referral_created",
          "referral_accepted",
          "referral_rejected",
          "referral_reassigned",
          "referral_status_changed",
          "property_price_decreased",
          "property_status_changed",
          "referral_message_received",
          "property_visit_requested",
          "property_visit_scheduled",
          "property_visit_updated",
          "property_visit_cancelled",
          "transaction_status_changed",
          "account_verification_approved",
          "account_verification_rejected",
          "account_status_changed",
          "property_agent_authorized",
          "property_agent_authorization_revoked",
        ],
      },
      isEnabled: {
        type: "boolean",
      },
    },
  },

  NotificationPreferencesResponse: {
    type: "object",
    required: ["message", "preferences"],
    properties: {
      message: {
        type: "string",
      },
      preferences: {
        type: "array",
        items: {
          $ref: "#/components/schemas/NotificationPreferenceItem",
        },
      },
    },
  },

  NotificationPreferenceMutationResponse: {
    type: "object",
    required: ["message", "preference"],
    properties: {
      message: {
        type: "string",
      },
      preference: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          notification_type: { type: "string" },
          is_enabled: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
} as const;
