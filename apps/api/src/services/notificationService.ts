
import {
  createNotification as insertNotification,
  listNotifications as fetchNotifications,
  markNotificationAsRead as updateNotificationRead,
  markAllNotificationsAsRead as updateAllNotificationsRead,
} from "../queries/notificationQueries";

export async function notifyUser(input: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return insertNotification(input);
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
