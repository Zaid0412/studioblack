import { NextResponse } from "next/server";
import {
  getTaskById,
  getTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateTaskCommentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/** PATCH /api/tasks/[id]/comments/[commentId] — edit own comment. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }
    const task = await getTaskById(params.id, { orgId });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await getTaskComment(orgId, params.commentId);
    if (!existing || existing.task_id !== params.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.author_id !== user.id) {
      return NextResponse.json(
        { error: "Only the author can edit this comment" },
        { status: 403 }
      );
    }

    const parsed = await parseRequest(req, updateTaskCommentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const updated = await updateTaskComment({
        orgId,
        commentId: params.commentId,
        authorId: user.id,
        body: parsed.data.body,
        attachments: parsed.data.attachments,
      });
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const task = await getTaskById(params.id, { orgId });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await getTaskComment(orgId, params.commentId);
    if (!existing || existing.task_id !== params.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.author_id !== user.id) {
      return NextResponse.json(
        { error: "Only the author can delete this comment" },
        { status: 403 }
      );
    }

    const removed = await deleteTaskComment({
      orgId,
      commentId: params.commentId,
      authorId: user.id,
    });
    if (!removed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
);
