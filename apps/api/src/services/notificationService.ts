import {
  createNotification as insertNotification,
  listNotifications as fetchNotifications,
  markNotificationAsRead as updateNotificationRead,
  markAllNotificationsAsRead as updateAllNotificationsRead,
  getUnreadNotificationCount as fetchUnreadNotificationCount,
  getNotificationPreferences as fetchNotificationPreferences,
  upsertNotificationPreference,
  createNotifications,
} from "../queries/notificationQueries";

import {
  notificationCreationSchema,
  type NotificationCreationInput,
  NOTIFICATION_TYPES,
  notificationPreferenceUpdateSchema,
  type NotificationPreferenceUpdateInput,
} from "../schemas/notificationSchema";

export async function notifyUser(input: NotificationCreationInput) {
  const validatedInput = notificationCreationSchema.parse(input);

  return insertNotification(validatedInput);
}

export async function getUserNotifications(input: {
  userId: string;
  page: number;
  limit: number;
  unreadOnly?: boolean;
}) {
  return fetchNotifications(input);
}

export async function markUserNotificationAsRead(input: {
  notificationId: string;
  userId: string;
}) {
  return updateNotificationRead(input);
}

export async function markAllUserNotificationsAsRead(userId: string) {
  return updateAllNotificationsRead(userId);
}

export async function getUserUnreadNotificationCount(userId: string) {
  return fetchUnreadNotificationCount(userId);
}

export async function getUserNotificationPreferences(userId: string) {
  const savedPreferences = await fetchNotificationPreferences(userId);

  return NOTIFICATION_TYPES.map((notificationType) => {
    const savedPreference = savedPreferences.find(
      (preference) => preference.notification_type === notificationType,
    );

    return {
      notificationType,
      isEnabled: savedPreference?.is_enabled ?? true,
    };
  });
}

export async function updateUserNotificationPreference(
  userId: string,
  input: NotificationPreferenceUpdateInput,
) {
  const validatedInput = notificationPreferenceUpdateSchema.parse(input);

  return upsertNotificationPreference({
    userId,
    notificationType: validatedInput.notificationType,
    isEnabled: validatedInput.isEnabled,
  });
}

export async function notifyMany(input: {
  recipientIds: string[];
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const validatedInput = notificationCreationSchema
    .omit({ recipientId: true })
    .extend({
      recipientIds: notificationCreationSchema.shape.recipientId
        .array()
        .min(1),
    })
    .parse(input);

  return createNotifications(validatedInput);
}
