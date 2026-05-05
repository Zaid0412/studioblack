import { NextResponse } from "next/server";
import {
  getTaskById,
  listTaskComments,
  createTaskComment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createTaskCommentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/** GET /api/tasks/[id]/comments — list comments on a task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }
    const task = await getTaskById(params.id, { orgId });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const comments = await listTaskComments(orgId, params.id);
    return NextResponse.json({ comments });
  }
);

/** POST /api/tasks/[id]/comments — post a new comment. */
export const POST = withAuth(
  {
    blockedRoles: ["client"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }
    const task = await getTaskById(params.id, { orgId });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
