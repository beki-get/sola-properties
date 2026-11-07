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
    `INSERT INTO notifications
       (recipient_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)
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

  return result.rows[0];
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

export async function markNotificationAsRead(input: {
  notificationId: string;
  userId: string;
}) {
  const result = await pool.query<NotificationRecord>(
    `UPDATE notifications
     SET is_read = TRUE,
         read_at = NOW()
     WHERE id = $1
       AND recipient_id = $2
       AND is_read = FALSE
     RETURNING *`,
    [input.notificationId, input.userId],
  );

  return result.rows[0] ?? null;
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
