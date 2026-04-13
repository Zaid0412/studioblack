import { NextResponse } from "next/server";
import {
  getComments,
  verifyResourceOwnership,
  createComment,
  getProjectName,
} from "@/lib/queries";
import {
  createNotificationsForTeam,
  createNotificationForClient,
  createNotification,
  notifyUserByEmailWithContext,
} from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createCommentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { extractMentionedUserIds } from "@/lib/mentions";
import { escapeHtml } from "@/lib/email";
import { env } from "@/env";

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

    const ownershipError = await verifyResourceOwnership(id, phaseId, taskId);
    if (ownershipError) {
      return NextResponse.json({ error: ownershipError }, { status: 404 });
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
      logger.error("Comment notification error", { projectId: id, error: err });
    }

    // Mention-specific notifications (in addition to team broadcast)
    const mentionedIds = extractMentionedUserIds(content.trim());
    const mentionsToNotify = mentionedIds.filter((uid) => uid !== user.id);
    const truncated =
      content.trim().length > 100
        ? content.trim().slice(0, 97) + "..."
        : content.trim();
    for (const uid of mentionsToNotify) {
      createNotification({
        userId: uid,
        type: "mention",
        title: `${user.name || "Someone"} mentioned you in a comment`,
        description: truncated,
        projectId: id,
      }).catch((err) =>
        logger.error("Mention notification failed", {
          projectId: id,
          error: err,
        })
      );
      notifyUserByEmailWithContext(uid, id, (ctx) => {
        const projectUrl = escapeHtml(
          `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
        );
        return {
          subject: `You were mentioned in ${ctx.projectName || "a project"}`,
          html: `<p><strong>${escapeHtml(user.name || user.email)}</strong> mentioned you in a comment in <strong>${escapeHtml(ctx.projectName || "")}</strong>.</p>
                 <p style="color: #666;">${escapeHtml(truncated)}</p>
                 <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`,
        };
      });
    }

    return NextResponse.json(comment, { status: 201 });
  }
);
