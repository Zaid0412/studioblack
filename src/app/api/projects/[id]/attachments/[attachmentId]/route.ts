import { NextResponse } from "next/server";
import { getAttachmentById, getAttachmentVersionHistory } from "@/lib/queries";
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
      versions = await getAttachmentVersionHistory(attachment.version_group);
    }

    return NextResponse.json({ ...attachment, versions });
  }
);
