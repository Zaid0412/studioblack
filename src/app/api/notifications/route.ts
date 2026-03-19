import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** GET /api/notifications — list notifications for current user. */
export const GET = withAuth({}, async (req, { user }) => {
  const pool = getPool();
  const { searchParams } = req.nextUrl;

  if (searchParams.get("unread") === "true") {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notification WHERE user_id = $1 AND read = false`,
      [user.id]
    );
    return NextResponse.json({ count: rows[0].count });
  }

  const { rows } = await pool.query(
    `SELECT n.*, p.name AS project_name
     FROM notification n
     LEFT JOIN project p ON p.id = n.project_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [user.id]
  );

  return NextResponse.json(rows);
});

/** PATCH /api/notifications — mark notifications as read. */
export const PATCH = withAuth({}, async (req, { user }) => {
  const pool = getPool();
  const body = await req.json();

  if (body.markAllRead) {
    await pool.query(
      `UPDATE notification SET read = true WHERE user_id = $1 AND read = false`,
      [user.id]
    );
  } else if (body.ids?.length) {
    await pool.query(
      `UPDATE notification SET read = true WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [user.id, body.ids]
    );
  }

  return NextResponse.json({ success: true });
});

/** DELETE /api/notifications — delete notifications. Pass { id } for single, omit for all. */
export const DELETE = withAuth({}, async (req, { user }) => {
  const pool = getPool();
  const body = await req.json().catch(() => ({}));

  if (body.id) {
    await pool.query(
      `DELETE FROM notification WHERE user_id = $1 AND id = $2`,
      [user.id, body.id]
    );
  } else {
    await pool.query(`DELETE FROM notification WHERE user_id = $1`, [user.id]);
  }

  return NextResponse.json({ success: true });
});
