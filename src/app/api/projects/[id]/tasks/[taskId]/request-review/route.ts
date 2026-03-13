import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hasProjectAccess } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/email";
import { createNotificationForClient } from "@/lib/notifications";

/** POST /api/projects/[id]/tasks/[taskId]/request-review — mark task for client review. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await params;
  const role = session.user.role;

  // Only PM or Architect can request client review
  if (role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await hasProjectAccess(id, session.user.id, session.user.email, role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pool = getPool();

  // Update the task
  const { rows: [task] } = await pool.query(
    `UPDATE phase_task
     SET requires_client_review = true,
         review_status = 'pending_review',
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [taskId]
  );

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Get the project to find the client email
  const { rows: [project] } = await pool.query(
    `SELECT client_email, client_name, name FROM project WHERE id = $1`,
    [id]
  );

  // Send notification to client if email exists
  if (project?.client_email) {
    const body = await req.json().catch(() => ({}));
    const message = (body as { message?: string }).message || "";

    await sendNotificationEmail(
      project.client_email,
      `Review Requested: ${task.title}`,
      `
        <p>A task in your project <strong>${project.name}</strong> requires your review.</p>
        <p><strong>Task:</strong> ${task.title}</p>
        ${message ? `<p><strong>Note:</strong> ${message}</p>` : ""}
        <p>Please log in to your project dashboard to review and provide feedback.</p>
      `
    ).catch(() => {
      // Don't fail the request if email fails
    });
  }

  // In-app notification for client
  await createNotificationForClient(
    id,
    "review_requested",
    "Review requested",
    `Task "${task.title}" in project "${project?.name || ""}" needs your review`
  ).catch(() => {});

  return NextResponse.json(task);
}
