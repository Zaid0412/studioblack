import { NextResponse } from "next/server";
import {
  getAttachmentById,
  createAttachmentReview,
  getAttachmentReviews,
  submitAttachmentReview,
} from "@/lib/queries";
import {
  createNotificationsForTeam,
  notifyTeamByEmail,
} from "@/lib/notifications";
import { escapeHtml } from "@/lib/email";
import { withAuth } from "@/lib/withAuth";
import { env } from "@/env";
import { parseRequest, submitReviewSchema } from "@/lib/validations";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/review — submit a review. */
export const PATCH = withAuth(
  { projectAccess: true, rateLimit: { limit: 10, windowMs: 60_000 } },
  async (req, { user }, params) => {
    const { id, attachmentId } = params;

    const parsed = await parseRequest(req, submitReviewSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { status, comment, annotatedFileUrl } = parsed.data;
    const annotationCount = parsed.data.annotationCount ?? 0;

    // Verify attachment belongs to this project
    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Guard: don't allow reviewing a frozen attachment
    if (attachment.frozen_at) {
      return NextResponse.json(
        { error: "Cannot review a frozen attachment" },
        { status: 409 }
      );
    }

    // Guard: don't allow re-approving/re-rejecting if already in that state
    if (attachment.review_status === status) {
      return NextResponse.json(
        { error: `Attachment is already ${status}` },
        { status: 409 }
      );
    }

    // Update status + freeze on approval + auto-create rejection task atomically
    const result = await submitAttachmentReview(
      attachmentId,
      id,
      user.id,
      status as "approved" | "rejected",
      comment
    );

    if (result.conflict) {
      return NextResponse.json(
        { error: `Attachment is already ${status}` },
        { status: 409 }
      );
    }
    const updated = result.attachment;

    // Create a review record (for history)
    await createAttachmentReview({
      attachmentId,
      reviewerId: user.id,
      status: status as "approved" | "rejected",
      comment: comment || "",
      annotatedFileUrl: annotatedFileUrl || null,
      annotationCount: annotationCount || 0,
    });

    // Notify team members (PM, architects) — in-app
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
    const safeFileName = escapeHtml(attachment.file_name);
    const safeReviewer = escapeHtml(reviewerName);
    const safeComment = comment
      ? `<p style="color:#555;margin-top:12px;">"${escapeHtml(comment)}"</p>`
      : "";
    const projectUrl = escapeHtml(
      `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
    );

    notifyTeamByEmail(id, [user.id], ({ projectName }) => ({
      subject:
        status === "approved"
          ? `${projectName} | Design Approved: ${attachment.file_name}`
          : `${projectName} | Changes Requested: ${attachment.file_name}`,
      html:
        status === "approved"
          ? `<p><strong>${safeReviewer}</strong> approved <strong>${safeFileName}</strong>.</p>${safeComment}<p style="margin-top:16px;">The file has been frozen and is ready for the next phase.</p><p style="margin-top:8px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`
          : `<p><strong>${safeReviewer}</strong> requested changes on <strong>${safeFileName}</strong>.</p>${safeComment}<p style="margin-top:16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`,
    }));

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
