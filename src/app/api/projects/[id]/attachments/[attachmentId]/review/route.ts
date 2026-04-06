import { NextResponse } from "next/server";
import {
  getAttachmentById,
  createAttachmentReview,
  getAttachmentReviews,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { createNotificationsForTeam } from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/env";

const VALID_STATUSES = ["approved", "rejected"];

/** PATCH /api/projects/[id]/attachments/[attachmentId]/review — submit a review. */
export const PATCH = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`review:${user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { id, attachmentId } = params;

    const body = await req.json();
    const { status, comment, annotatedFileUrl } = body;
    const annotationCount =
      body.annotationCount != null &&
      Number.isInteger(Number(body.annotationCount)) &&
      Number(body.annotationCount) >= 0
        ? Number(body.annotationCount)
        : 0;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Verify attachment belongs to this project
    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Guard: don't allow re-approving/re-rejecting if already in that state
    if (attachment.review_status === status) {
      return NextResponse.json(
        { error: `Attachment is already ${status}` },
        { status: 409 }
      );
    }

    // Update status + freeze on approval atomically
    const pool = getPool();
    const client = await pool.connect();
    let updated;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `UPDATE attachment
         SET review_status = $1, reviewed_by = $2
         WHERE id = $3
         RETURNING *`,
        [status, user.id, attachmentId]
      );
      updated = rows[0];
      if (status === "approved") {
        await client.query(
          `UPDATE attachment SET frozen_at = NOW() WHERE id = $1`,
          [attachmentId]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Create a review record (for history)
    await createAttachmentReview({
      attachmentId,
      reviewerId: user.id,
      status: status as "approved" | "rejected",
      comment: comment || "",
      annotatedFileUrl: annotatedFileUrl || null,
      annotationCount: annotationCount || 0,
    });

    // Notify team members (PM, architects)
    const reviewerName = user.name || "Client";
    const notifTitle =
      status === "approved"
        ? `${reviewerName} approved "${attachment.file_name}"`
        : `${reviewerName} requested changes on "${attachment.file_name}"`;
    const notifDescription = comment || undefined;

    await createNotificationsForTeam(
      id,
      user.id,
      status === "approved" ? "review_approved" : "review_changes_requested",
      notifTitle,
      notifDescription
    );

    // Send email notifications to org team members (fire-and-forget)
    const pool2 = getPool();
    pool2
      .query(
        `SELECT DISTINCT u.email, u.name
         FROM project p
         JOIN member m ON m."organizationId" = p.org_id
         JOIN "user" u ON u.id = m."userId"
         WHERE p.id = $1 AND m."userId" != $2`,
        [id, user.id]
      )
      .then(({ rows: teamMembers }) => {
        const safeFileName = escapeHtml(attachment.file_name);
        const safeReviewer = escapeHtml(reviewerName);
        const safeComment = comment
          ? `<p style="color:#555;margin-top:12px;">"${escapeHtml(comment)}"</p>`
          : "";
        const projectUrl = escapeHtml(
          `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
        );

        for (const member of teamMembers) {
          const subject =
            status === "approved"
              ? `Design Approved: ${attachment.file_name}`
              : `Changes Requested: ${attachment.file_name}`;
          const body =
            status === "approved"
              ? `<p><strong>${safeReviewer}</strong> approved <strong>${safeFileName}</strong>.</p>${safeComment}<p style="margin-top:16px;">The file has been frozen and is ready for the next phase.</p><p style="margin-top:8px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`
              : `<p><strong>${safeReviewer}</strong> requested changes on <strong>${safeFileName}</strong>.</p>${safeComment}<p style="margin-top:16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`;

          sendNotificationEmail(member.email, subject, body).catch(
            console.error
          );
        }
      })
      .catch(console.error);

    return NextResponse.json(updated);
  }
);

/** GET /api/projects/[id]/attachments/[attachmentId]/review — get review history. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { attachmentId } = params;

    const reviews = await getAttachmentReviews(attachmentId);
    return NextResponse.json(reviews);
  }
);
