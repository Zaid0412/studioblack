import { NextResponse } from "next/server";
import { verifyTaskOwnership } from "@/lib/queries";
import { getPool } from "@/lib/db";
import {
  createNotification,
  createNotificationsForTeam,
} from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";

/** POST /api/projects/[id]/tasks/[taskId]/review — client approves or requests changes. */
export const POST = withAuth(
  { allowedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id, taskId } = params;

    const taskOwned = await verifyTaskOwnership(taskId, id);
    if (!taskOwned) {
      return NextResponse.json(
        { error: "Task not found in this project" },
        { status: 404 }
      );
    }

    const { action, comment } = await req.json();

    if (!action || !["approved", "changes_requested"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approved' or 'changes_requested'" },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Verify the task exists and is pending review
    const {
      rows: [existing],
    } = await pool.query(
      `SELECT * FROM phase_task WHERE id = $1 AND review_status = 'pending_review'`,
      [taskId]
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Task not found or not pending review" },
        { status: 404 }
      );
    }

    // Update review status
    const {
      rows: [task],
    } = await pool.query(
      `UPDATE phase_task
     SET review_status = $1,
         status = CASE WHEN $1 = 'approved' THEN 'approved' ELSE 'changes_requested' END,
         updated_at = now()
     WHERE id = $2
     RETURNING *`,
      [action, taskId]
    );

    // If client left a comment, insert it
    if (comment?.trim()) {
      await pool.query(
        `INSERT INTO comment (project_id, phase_id, task_id, user_id, content)
       VALUES ($1, $2, $3, $4, $5)`,
        [id, existing.phase_id, taskId, user.id, comment.trim()]
      );
    }

    // Notify team about the review decision
    const statusLabel =
      action === "approved" ? "approved" : "requested changes on";
    await createNotificationsForTeam(
      id,
      user.id,
      "review_submitted",
      `Client ${statusLabel} a task`,
      `${user.name} ${statusLabel} "${task.title}"${comment?.trim() ? `: "${comment.trim()}"` : ""}`
    ).catch(() => {});

    // Notify the task assignee specifically if they're different from team notification
    if (existing.assigned_to) {
      await createNotification({
        userId: existing.assigned_to,
        type: "review_submitted",
        title: `Client ${statusLabel} your task`,
        description: `"${task.title}" was ${statusLabel} by ${user.name}`,
        projectId: id,
        taskId: taskId,
      }).catch(() => {});
    }

    return NextResponse.json(task);
  }
);
