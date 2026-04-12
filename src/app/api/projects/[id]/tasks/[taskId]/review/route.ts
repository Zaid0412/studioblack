import { NextResponse } from "next/server";
import {
  verifyTaskOwnership,
  getPhaseTaskPendingReview,
  updatePhaseTaskReviewStatus,
  createComment,
} from "@/lib/queries";
import {
  createNotification,
  createNotificationsForTeam,
} from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, submitTaskReviewSchema } from "@/lib/validations";

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

    const parsed = await parseRequest(req, submitTaskReviewSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { action, comment } = parsed.data;

    // Verify the task exists and is pending review
    const existing = await getPhaseTaskPendingReview(taskId);

    if (!existing) {
      return NextResponse.json(
        { error: "Task not found or not pending review" },
        { status: 404 }
      );
    }

    // Update review status
    const task = await updatePhaseTaskReviewStatus(taskId, action);

    // If client left a comment, insert it
    if (comment?.trim()) {
      await createComment({
        projectId: id,
        phaseId: existing.phase_id,
        taskId,
        userId: user.id,
        content: comment.trim(),
      });
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
