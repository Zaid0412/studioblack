import { NextResponse } from "next/server";
import { verifyTaskOwnership } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { createNotificationForClient } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";

/** POST /api/projects/[id]/tasks/[taskId]/request-review — mark task for client review. */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id, taskId } = params;

    const taskOwned = await verifyTaskOwnership(taskId, id);
    if (!taskOwned) {
      return NextResponse.json(
        { error: "Task not found in this project" },
        { status: 404 }
      );
    }

    const pool = getPool();

    // Update the task
    const {
      rows: [task],
    } = await pool.query(
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
    const {
      rows: [project],
    } = await pool.query(
      `SELECT client_email, client_name, name FROM project WHERE id = $1`,
      [id]
    );

    // Send notification to client if email exists
    if (project?.client_email) {
      await sendNotificationEmail(
        project.client_email,
        `Review Requested: ${task.title}`,
        `
        <p>A task in your project <strong>${escapeHtml(project.name)}</strong> requires your review.</p>
        <p><strong>Task:</strong> ${escapeHtml(task.title)}</p>
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
);
