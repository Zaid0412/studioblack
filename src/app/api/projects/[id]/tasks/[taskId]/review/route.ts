import { NextResponse } from "next/server";
import {
  getPhaseTaskPendingReview,
  updatePhaseTaskReviewStatus,
  createComment,
} from "@/lib/queries";
import {
  createNotification,
  createNotificationsForTeam,
  notifyUserByEmailWithContext,
} from "@/lib/notifications";
import { escapeHtml } from "@/lib/email";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, submitTaskReviewSchema } from "@/lib/validations";
import { guardTaskOwnership } from "@/app/api/tasks/helpers";

/** POST /api/projects/[id]/tasks/[taskId]/review — client approves or requests changes. */
export const POST = withAuth(
  { allowedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id, taskId } = params;

    const result = await guardTaskOwnership(taskId, id);
    if (result instanceof NextResponse) return result;

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
      }).catch((err) =>
        logger.error("Task review notification failed", {
          projectId: id,
          taskId,
          error: err,
        })
      );

      notifyUserByEmailWithContext(existing.assigned_to, id, (ctx) => {
        const projectUrl = escapeHtml(
          `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
        );
        const safeTitle = escapeHtml(task.title);
        const safeClient = escapeHtml(user.name || user.email);
        const safeComment = comment?.trim() ? escapeHtml(comment.trim()) : null;
        return {
          subject: ctx.projectName
            ? `${ctx.projectName} | Client ${statusLabel} your task`
            : `Client ${statusLabel} your task`,
          html: `<p><strong>${safeClient}</strong> ${statusLabel} <strong>${safeTitle}</strong>.</p>
            ${safeComment ? `<p style="color: #666;">Comment: "${safeComment}"</p>` : ""}
            <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`,
        };
      });
    }

    return NextResponse.json(task);
  }
);
