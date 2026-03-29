import { NextResponse } from "next/server";
import {
  getAttachmentById,
  getAttachmentVersionHistory,
  deleteAttachment,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/attachments/[attachmentId] — get single attachment with version history. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id, attachmentId } = params;

    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
  async (req, { user }, params) => {
    const { id, attachmentId } = params;

    // Architects can only delete their own uploads
    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const effectiveRole = user.role === "pm" ? "pm" : "architect";
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

    await deleteAttachment(attachmentId, id);
    return NextResponse.json({ success: true });
  }
);

/** PATCH /api/projects/[id]/attachments/[attachmentId] — update attachment status (e.g. mark reviewed). */
export const PATCH = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id, attachmentId } = params;
    const body = await req.json();
    const { reviewStatus } = body;

    if (!reviewStatus) {
      return NextResponse.json(
        { error: "reviewStatus is required" },
        { status: 400 }
      );
    }

    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pool = getPool();
    const { rows: [updated] } = await pool.query(
      `UPDATE attachment SET review_status = $1 WHERE id = $2 AND project_id = $3 RETURNING *`,
      [reviewStatus, attachmentId, id]
    );

    return NextResponse.json(updated);
  }
);
