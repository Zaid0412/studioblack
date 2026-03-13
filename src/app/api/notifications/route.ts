import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPool } from "@/lib/db";

/** GET /api/notifications — list notifications for current user. */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const { searchParams } = req.nextUrl;

  if (searchParams.get("unread") === "true") {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notification WHERE user_id = $1 AND read = false`,
      [session.user.id]
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
    [session.user.id]
  );

  return NextResponse.json(rows);
}

/** PATCH /api/notifications — mark notifications as read. */
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const body = await req.json();

  if (body.markAllRead) {
    await pool.query(
      `UPDATE notification SET read = true WHERE user_id = $1 AND read = false`,
      [session.user.id]
    );
  } else if (body.ids?.length) {
    await pool.query(
      `UPDATE notification SET read = true WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [session.user.id, body.ids]
    );
  }

  return NextResponse.json({ success: true });
}
