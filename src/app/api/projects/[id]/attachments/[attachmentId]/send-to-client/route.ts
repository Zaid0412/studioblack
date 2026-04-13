import { NextResponse } from "next/server";
import {
  markAttachmentSentToClient,
  getProjectClientInfo,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createNotificationForClient } from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { findAttachmentOrFail } from "../../helpers";

/** POST /api/projects/[id]/attachments/[attachmentId]/send-to-client — make file visible to client. */
export const POST = withAuth(
  {
    projectAccess: true,
    blockedRoles: ["client"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user }, params) => {
    const { id, attachmentId } = params;

    const attachmentOrError = await findAttachmentOrFail(attachmentId, id);
    if (attachmentOrError instanceof NextResponse) return attachmentOrError;
    const attachment = attachmentOrError;

    if (attachment.sent_to_client_at) {
      return NextResponse.json(
        { error: "Already sent to client" },
        { status: 409 }
      );
    }

    // Update attachment + fetch project info in parallel
    const [updated, proj] = await Promise.all([
      markAttachmentSentToClient(attachmentId, user.id),
      getProjectClientInfo(id),
    ]);

    if (!updated) {
      return NextResponse.json(
        { error: "Already sent to client" },
        { status: 409 }
      );
    }

    // In-app notification to client
    createNotificationForClient(
      id,
      "design_sent_for_review",
      "New design ready for review",
      `"${attachment.file_name}" has been sent for your review`
    ).catch((err) =>
      logger.error("Client notification for design review failed", {
        projectId: id,
        attachmentId,
        error: err,
      })
    );

    // Email notification to client (fire-and-forget)
    if (proj?.client_email) {
      const senderName = escapeHtml(user.name || user.email);
      const projectUrl = escapeHtml(
        `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
      );
      const subject = `Design Ready for Review: ${proj.project_name}`;
      const body = `<p><strong>${senderName}</strong> has sent a design for your review in <strong>${escapeHtml(proj.project_name)}</strong>.</p>
        <p style="color: #666;">File: ${escapeHtml(attachment.file_name)}</p>
        <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Design →</a></p>`;
      sendNotificationEmail(proj.client_email, subject, body).catch((err) =>
        logger.error("Client design review email failed", {
          projectId: id,
          clientEmail: proj.client_email,
          error: err,
        })
      );
    }

    return NextResponse.json(updated);
  }
);
