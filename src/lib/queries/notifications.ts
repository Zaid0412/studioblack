import { getPool } from "@/lib/db";

/**
 * Get a user's notifications (most recent 50), with project name.
 *
 * `unreadOnly` is the bell's view: it is a queue of what still needs attention,
 * and reading a notification is how it leaves the list. It must stay a caller's
 * choice rather than being baked in here — /audit reads the same rows precisely
 * because it wants the history, read ones included.
 */
export async function getNotifications(
  userId: string,
  { unreadOnly = false }: { unreadOnly?: boolean } = {}
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT n.*, p.name AS project_name
     FROM notification n
     LEFT JOIN project p ON p.id = n.project_id
     WHERE n.user_id = $1 AND ($2::boolean = false OR n.read = false)
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [userId, unreadOnly]
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
