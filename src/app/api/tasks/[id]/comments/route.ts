import { NextResponse } from "next/server";
import { createTaskComment } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createTaskCommentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * POST /api/tasks/[id]/comments — post a new comment.
 *
 * GET was removed: comments are now read via `/api/tasks/[id]/activity`,
 * which already returns the merged comment + audit-event feed used by
 * both the side panel and `/tasks/[id]`. The activity endpoint filters
 * by org_id + task_id, so the side panel's comment thread comes from
 * the same SWR cache key as the timeline rail — keeping them in sync
 * across surfaces with no duplicate fetch.
 */
export const POST = withAuth(
  {
    blockedRoles: ["client"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }

    const parsed = await parseRequest(req, createTaskCommentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const comment = await createTaskComment({
        orgId,
        taskId: params.id,
        authorId: user.id,
        body: parsed.data.body,
        attachments: parsed.data.attachments,
      });
      // `createTaskComment` returns null when the task doesn't exist in
      // the caller's org — the existence check is folded into the INSERT
      // CTE so this is the same SQL round trip as the create.
      if (!comment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(comment, { status: 201 });
    } catch (err) {
      logger.error("Task comment create failed", {
        taskId: params.id,
        error: err,
      });
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }
  }
);
