import { NextResponse } from "next/server";
import {
  getAttachmentVersionHistory,
  deleteAttachment,
  updateAttachmentStatus,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateAttachmentStatusSchema } from "@/lib/validations";
import { findAttachmentOrFail, failIfIssued } from "../helpers";

/** GET /api/projects/[id]/attachments/[attachmentId] — get single attachment with version history. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id, attachmentId } = params;

    const attachmentOrError = await findAttachmentOrFail(attachmentId, id);
    if (attachmentOrError instanceof NextResponse) return attachmentOrError;
    const attachment = attachmentOrError;

    // Include version history if this file has versions
    let versions: unknown[] = [];
    if (attachment.version_group) {
      versions = await getAttachmentVersionHistory(
        attachment.version_group,
        id
      );
    }

    return NextResponse.json({ ...attachment, versions });
  }
);

/** DELETE /api/projects/[id]/attachments/[attachmentId] — remove an attachment. */
export const DELETE = withAuth(
  { projectAccess: true, allowedRoles: ["pm", "architect"] },
  async (req, { user, effectiveRole }, params) => {
    const { id, attachmentId } = params;

    // Architects can only delete their own uploads
    const attachmentOrErr = await findAttachmentOrFail(attachmentId, id);
    if (attachmentOrErr instanceof NextResponse) return attachmentOrErr;
    const attachment = attachmentOrErr;
    if (effectiveRole === "architect" && attachment.uploaded_by !== user.id) {
      return NextResponse.json(
        { error: "You can only remove files you uploaded" },
        { status: 403 }
      );
    }

    if (attachment.frozen_at) {
      return NextResponse.json(
        { error: "Cannot delete a frozen file" },
        { status: 400 }
      );
    }

    const issuedError = await failIfIssued(attachmentId);
    if (issuedError) return issuedError;

    await deleteAttachment(attachmentId, id);
    return NextResponse.json({ success: true });
  }
);

/** PATCH /api/projects/[id]/attachments/[attachmentId] — update attachment status (e.g. mark reviewed). */
export const PATCH = withAuth(
  { projectAccess: true, blockedRoles: ["client"] },
  async (req, ctx, params) => {
    const { id, attachmentId } = params;
    const parsed = await parseRequest(req, updateAttachmentStatusSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { reviewStatus } = parsed.data;

    const patchAttOrErr = await findAttachmentOrFail(attachmentId, id);
    if (patchAttOrErr instanceof NextResponse) return patchAttOrErr;

    if (patchAttOrErr.frozen_at) {
      return NextResponse.json(
        { error: "Cannot update status of a frozen attachment" },
        { status: 409 }
      );
    }

    const updated = await updateAttachmentStatus(
      attachmentId,
      id,
      reviewStatus
    );

    return NextResponse.json(updated);
  }
);
