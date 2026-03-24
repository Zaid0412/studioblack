import { NextResponse } from "next/server";
import { getAttachmentById, getAttachmentVersionHistory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/attachments/[attachmentId]/versions — get version history. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id, attachmentId } = params;

    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment || !attachment.version_group) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const versions = await getAttachmentVersionHistory(
      attachment.version_group,
      id
    );
    return NextResponse.json(versions);
  }
);
