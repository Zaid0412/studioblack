import { NextResponse } from "next/server";
import {
  getAttachmentById,
  updateAttachmentReviewStatus,
  createAttachmentReview,
  getAttachmentReviews,
} from "@/lib/queries";
import { createNotificationsForTeam } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";

const VALID_STATUSES = ["approved", "rejected", "reviewed", "pending"];

/** PATCH /api/projects/[id]/attachments/[attachmentId]/review — submit a review. */
export const PATCH = withAuth(
  { allowedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id, attachmentId } = params;

    const body = await req.json();
    const { status, comment, annotatedFileUrl, annotationCount } = body;

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

    // Update the attachment's review_status
    const updated = await updateAttachmentReviewStatus(
      attachmentId,
      status,
      user.id
    );

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
