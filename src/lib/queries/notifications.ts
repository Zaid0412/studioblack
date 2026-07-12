import { getPool } from "@/lib/db";

/** Get unread notification count for a user. */
export async function getUnreadNotificationCount(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notification WHERE user_id = $1 AND read = false`,
    [userId]
  );
  return rows[0].count as number;
}

/**
 * Get a user's *unread* notifications (most recent 50), with project name.
 *
 * The bell is a queue of what still needs attention, not a history: reading a
 * notification is how it leaves the list. Read rows are kept — they still feed
 * the dashboard activity feed via `getRecentActivity`, which deliberately does
 * not filter on `read`.
 */
export async function getNotifications(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT n.*, p.name AS project_name
     FROM notification n
     LEFT JOIN project p ON p.id = n.project_id
     WHERE n.user_id = $1 AND n.read = false
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}

/** Get recent notifications for a user (dashboard activity feed). */
export async function getRecentActivity(userId: string, limit = 10) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT n.id, n.type, n.title, n.description, n.created_at, p.name AS project_name
     FROM notification n
     LEFT JOIN project p ON p.id = n.project_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

/** Mark all unread notifications as read for a user. */
export async function markAllNotificationsRead(userId: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE notification SET read = true WHERE user_id = $1 AND read = false`,
    [userId]
  );
}

/** Mark specific notifications as read by IDs. */
export async function markNotificationsReadByIds(
  userId: string,
  ids: string[]
) {
  const pool = getPool();
  await pool.query(
    `UPDATE notification SET read = true WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids]
  );
}

/** Delete a single notification by ID. */
export async function deleteNotification(userId: string, id: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM notification WHERE user_id = $1 AND id = $2`, [
    userId,
    id,
  ]);
}

/** Delete all notifications for a user. */
export async function deleteAllNotifications(userId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM notification WHERE user_id = $1`, [userId]);
}
