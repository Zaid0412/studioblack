import { NextResponse } from "next/server";
import {
  getComments,
  verifyPhaseOwnership,
  verifyTaskOwnership,
  createComment,
  getProjectName,
} from "@/lib/queries";
import {
  createNotificationsForTeam,
  createNotificationForClient,
} from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createCommentSchema } from "@/lib/validations";

/** GET /api/projects/[id]/comments — list comments. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const { searchParams } = req.nextUrl;
    const comments = await getComments({
      projectId: id,
      phaseId: searchParams.get("phaseId") || undefined,
      taskId: searchParams.get("taskId") || undefined,
    });

    return NextResponse.json(comments);
  }
);

/** POST /api/projects/[id]/comments — add a comment (all roles). */
export const POST = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { id } = params;

    const parsed = await parseRequest(req, createCommentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { content, phaseId, taskId } = parsed.data;

    if (phaseId) {
      const phaseOwned = await verifyPhaseOwnership(phaseId, id);
      if (!phaseOwned) {
        return NextResponse.json(
          { error: "Phase not found in this project" },
          { status: 404 }
        );
      }
    }
    if (taskId) {
      const taskOwned = await verifyTaskOwnership(taskId, id);
      if (!taskOwned) {
        return NextResponse.json(
          { error: "Task not found in this project" },
          { status: 404 }
        );
      }
    }

    const comment = await createComment({
      projectId: id,
      phaseId: phaseId || null,
      taskId: taskId || null,
      userId: user.id,
      content: content.trim(),
    });

    // Notify team + client about new comment
    try {
      const userName = user.name || user.email;
      const projName = await getProjectName(id);
      const title = `New comment on ${projName || "project"}`;
      const desc = `${userName}: ${content.trim().slice(0, 100)}`;
      await createNotificationsForTeam(id, user.id, "comment", title, desc);
      if (user.role !== "client") {
        await createNotificationForClient(id, "comment", title, desc);
      }
    } catch (err) {
      console.error("[comment] notification error:", err);
    }

    return NextResponse.json(comment, { status: 201 });
  }
);
