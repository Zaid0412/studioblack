import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getAttachmentById,
  updateAttachmentReviewStatus,
  hasProjectAccess,
} from "@/lib/queries";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

const VALID_STATUSES = ["approved", "rejected", "reviewed", "pending"];

/** PATCH /api/projects/[id]/attachments/[attachmentId]/review — update review status. */
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

  const { status } = await req.json();
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify attachment belongs to this project
  const attachment = await getAttachmentById(attachmentId, id);
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await updateAttachmentReviewStatus(
    attachmentId,
    status,
    session.user.id
  );

  return NextResponse.json(updated);
}
