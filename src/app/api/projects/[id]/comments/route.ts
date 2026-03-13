import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getComments, hasProjectAccess } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { createNotificationsForTeam, createNotificationForClient } from "@/lib/notifications";

/** GET /api/projects/[id]/comments — list comments. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(id, session.user.id, session.user.email, session.user.role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const comments = await getComments({
    projectId: id,
    phaseId: searchParams.get("phaseId") || undefined,
    taskId: searchParams.get("taskId") || undefined,
  });

  return NextResponse.json(comments);
}

/** POST /api/projects/[id]/comments — add a comment (all roles). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(id, session.user.id, session.user.email, session.user.role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content, phaseId, taskId } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const pool = getPool();
  const { rows: [comment] } = await pool.query(
    `INSERT INTO comment (project_id, phase_id, task_id, user_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, phaseId || null, taskId || null, session.user.id, content.trim()]
  );

  // Notify team + client about new comment
  try {
    const userName = session.user.name || session.user.email;
    const { rows: [proj] } = await pool.query(`SELECT name FROM project WHERE id = $1`, [id]);
    const title = `New comment on ${proj?.name || "project"}`;
    const desc = `${userName}: ${content.trim().slice(0, 100)}`;
    await createNotificationsForTeam(id, session.user.id, "comment", title, desc);
    if (session.user.role !== "client") {
      await createNotificationForClient(id, "comment", title, desc);
    }
  } catch (err) {
    console.error("[comment] notification error:", err);
  }

  return NextResponse.json(comment, { status: 201 });
}
