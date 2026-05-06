import { NextResponse } from "next/server";
import {
  getTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateTaskCommentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * Disambiguate a write that returned no rows: the org+task+author filter
 * matched nothing, but is it because the comment doesn't exist (404) or
 * because the caller isn't the author (403)? One follow-up lookup —
 * only on the failure path — answers it.
 */
async function disambiguateMiss(
  orgId: string,
  commentId: string,
  taskId: string
): Promise<NextResponse> {
  const existing = await getTaskComment(orgId, commentId);
  if (!existing || existing.task_id !== taskId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { error: "Only the author can modify this comment" },
    { status: 403 }
  );
}

/** PATCH /api/tasks/[id]/comments/[commentId] — edit own comment. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }

    const parsed = await parseRequest(req, updateTaskCommentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const updated = await updateTaskComment({
        orgId,
        commentId: params.commentId,
        taskId: params.id,
        authorId: user.id,
        body: parsed.data.body,
        attachments: parsed.data.attachments,
      });
      if (!updated) {
        return disambiguateMiss(orgId, params.commentId, params.id);
      }
      return NextResponse.json(updated);
    } catch (err) {
      logger.error("Task comment update failed", {
        commentId: params.commentId,
        error: err,
      });
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }
  }
);

/** DELETE /api/tasks/[id]/comments/[commentId] — delete own comment. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }

    const removed = await deleteTaskComment({
      orgId,
      commentId: params.commentId,
      taskId: params.id,
      authorId: user.id,
    });
    if (!removed) {
      return disambiguateMiss(orgId, params.commentId, params.id);
    }
    return NextResponse.json({ success: true });
  }
);
