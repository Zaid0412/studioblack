import { NextResponse } from "next/server";
import { getAttachmentById } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { createNotificationForClient } from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { env } from "@/env";

/** POST /api/projects/[id]/attachments/[attachmentId]/send-to-client — make file visible to client. */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client"] },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`send-client:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { id, attachmentId } = params;

    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (attachment.sent_to_client_at) {
      return NextResponse.json(
        { error: "Already sent to client" },
        { status: 409 }
      );
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE attachment
       SET sent_to_client_at = NOW(), sent_to_client_by = $1
       WHERE id = $2
       RETURNING *`,
      [user.id, attachmentId]
    );

    // In-app notification to client
    createNotificationForClient(
      id,
      "design_sent_for_review",
      "New design ready for review",
      `"${attachment.file_name}" has been sent for your review`
    );

    // Email notification to client (fire-and-forget)
    pool
      .query(
        `SELECT p.name AS project_name, p.client_email
         FROM project p WHERE p.id = $1`,
        [id]
      )
      .then(({ rows: projRows }) => {
        const proj = projRows[0];
        if (!proj?.client_email) return;
        const senderName = escapeHtml(user.name || user.email);
        const projectUrl = escapeHtml(
          `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
        );
        const subject = `Design Ready for Review: ${proj.project_name}`;
        const body = `<p><strong>${senderName}</strong> has sent a design for your review in <strong>${escapeHtml(proj.project_name)}</strong>.</p>
          <p style="color: #666;">File: ${escapeHtml(attachment.file_name)}</p>
          <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Design →</a></p>`;
        sendNotificationEmail(proj.client_email, subject, body).catch(
          console.error
        );
      })
      .catch(console.error);

    return NextResponse.json(rows[0]);
  }
);
