import { NextResponse } from "next/server";
import { markPhaseTaskForReview, getProjectReviewInfo } from "@/lib/queries";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { createNotificationForClient } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/withAuth";
import { guardTaskOwnership } from "@/app/api/tasks/helpers";

/** POST /api/projects/[id]/tasks/[taskId]/request-review — mark task for client review. */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, taskId } = params;

    const result = await guardTaskOwnership(taskId, id);
    if (result instanceof NextResponse) return result;

    // Update the task
    const task = await markPhaseTaskForReview(taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get the project to find the client email
    const project = await getProjectReviewInfo(id);

    // Send notification to client if email exists
    if (project?.client_email) {
      await sendNotificationEmail(
        project.client_email,
        `${project.name} | Review Requested: ${task.title}`,
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
    ).catch((err) =>
      logger.error("Review request client notification failed", {
        projectId: id,
        taskId,
        error: err,
      })
    );

    return NextResponse.json(task);
  }
);
