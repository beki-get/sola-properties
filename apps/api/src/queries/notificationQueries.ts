import type { PoolClient } from "pg";
import { pool } from "../config/database";

export type NotificationRecord = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
};
export async function createNotification(
  input: {
    recipientId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: string | null;
  },
  client?: PoolClient,
) {
  const db = client ?? pool;

  const result = await db.query(
    `INSERT INTO notifications (
       recipient_id,
       type,
       title,
       message,
       entity_type,
       entity_id
     )
     SELECT $1, $2, $3, $4, $5, $6
     WHERE NOT EXISTS (
       SELECT 1
       FROM notification_preferences
       WHERE user_id = $1
         AND notification_type = $2
         AND is_enabled = FALSE
     )
     RETURNING *`,
    [
      input.recipientId,
      input.type,
      input.title,
      input.message,
      input.entityType ?? null,
      input.entityId ?? null,
    ],
  );

  return result.rows[0] ?? null;
}

export async function listNotifications(input: {
  userId: string;
  page: number;
  limit: number;
  unreadOnly?: boolean;
}) {
  const params: unknown[] = [input.userId];
  let where = "recipient_id = $1";

  if (input.unreadOnly) {
    where += " AND is_read = FALSE";
  }

  const offset = (input.page - 1) * input.limit;

  const result = await pool.query<NotificationRecord>(
    `SELECT *
     FROM notifications
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [input.userId, input.limit, offset],
  );

  const totalResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE ${where}`,
    params,
  );

  return {
    items: result.rows,
    page: input.page,
    limit: input.limit,
    total: Number(totalResult.rows[0]?.count ?? 0),
  };
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE,
         read_at = NOW()
     WHERE recipient_id = $1
       AND is_read = FALSE`,
    [userId],
  );

  return result.rowCount ?? 0;
}

export async function markNotificationAsRead(input: {
  notificationId: string;
  userId: string;
}) {
  const result = await pool.query<NotificationRecord>(
    `UPDATE notifications
     SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND recipient_id = $2
     RETURNING *`,
    [input.notificationId, input.userId],
  );

  return result.rows[0] ?? null;
}

export async function getUnreadNotificationCount(userId: string) {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [userId],
  );

  return result.rows[0]?.count ?? 0;
}

//
export async function getNotificationPreferences(userId: string) {
  const result = await pool.query<{
    notification_type: string;
    is_enabled: boolean;
  }>(
    `SELECT notification_type, is_enabled
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows;
}

//
export async function upsertNotificationPreference(input: {
  userId: string;
  notificationType: string;
  isEnabled: boolean;
}) {
  const result = await pool.query(
    `INSERT INTO notification_preferences (
       user_id, notification_type, is_enabled
     )
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, notification_type)
     DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       updated_at = NOW()
     RETURNING *`,
    [input.userId, input.notificationType, input.isEnabled],
  );

  return result.rows[0];
}

//creation of notifications for multiple recipients
export async function createNotifications(
  input: {
    recipientIds: string[];
    type: string;
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: string | null;
  },
) {
  if (input.recipientIds.length === 0) return [];

  const result = await pool.query(
    `INSERT INTO notifications (
       recipient_id,
       type,
       title,
       message,
       entity_type,
       entity_id
     )
     SELECT recipients.user_id, $2, $3, $4, $5, $6
     FROM (
       SELECT DISTINCT unnest($1::uuid[]) AS user_id
     ) AS recipients
     WHERE NOT EXISTS (
       SELECT 1
       FROM notification_preferences
       WHERE user_id = recipients.user_id
         AND notification_type = $2
         AND is_enabled = FALSE
     )
     RETURNING *`,
    [
      input.recipientIds,
      input.type,
      input.title,
      input.message,
      input.entityType ?? null,
      input.entityId ?? null,
    ],
  );

  return result.rows;
}