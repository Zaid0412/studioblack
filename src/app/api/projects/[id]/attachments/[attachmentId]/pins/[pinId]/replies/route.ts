import { NextResponse } from "next/server";
import { getPinCommentById, getPinCommentReplies } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/attachments/[attachmentId]/pins/[pinId]/replies */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { attachmentId, pinId } = params;

    const pin = await getPinCommentById(pinId);
    if (!pin || pin.attachment_id !== attachmentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const replies = await getPinCommentReplies(pinId);
    return NextResponse.json(replies);
  }
);
