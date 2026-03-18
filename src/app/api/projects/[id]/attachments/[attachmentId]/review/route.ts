import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getAttachmentById,
  updateAttachmentReviewStatus,
  createAttachmentReview,
  getAttachmentReviews,
  hasProjectAccess,
} from "@/lib/queries";
import { createNotificationsForTeam } from "@/lib/notifications";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

const VALID_STATUSES = ["approved", "rejected", "reviewed", "pending"];

/** PATCH /api/projects/[id]/attachments/[attachmentId]/review — submit a review. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, attachmentId } = await params;
  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only clients can approve/reject designs
  if (session.user.role !== "client") {
    return NextResponse.json(
      { error: "Only clients can review designs" },
      { status: 403 }
    );
  }

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
    session.user.id
  );

  // Create a review record (for history)
  await createAttachmentReview({
    attachmentId,
    reviewerId: session.user.id,
    status: status as "approved" | "rejected",
    comment: comment || "",
    annotatedFileUrl: annotatedFileUrl || null,
    annotationCount: annotationCount || 0,
  });

  // Notify team members (PM, architects)
  const reviewerName = session.user.name || "Client";
  const notifTitle =
    status === "approved"
      ? `${reviewerName} approved "${attachment.file_name}"`
      : `${reviewerName} requested changes on "${attachment.file_name}"`;
  const notifDescription = comment || undefined;

  await createNotificationsForTeam(
    id,
    session.user.id,
    status === "approved" ? "review_approved" : "review_changes_requested",
    notifTitle,
    notifDescription
  );

  return NextResponse.json(updated);
}

/** GET /api/projects/[id]/attachments/[attachmentId]/review — get review history. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, attachmentId } = await params;
  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviews = await getAttachmentReviews(attachmentId);
  return NextResponse.json(reviews);
}
