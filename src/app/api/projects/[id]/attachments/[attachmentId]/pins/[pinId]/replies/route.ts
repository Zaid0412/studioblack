import { NextResponse } from "next/server";
import { getPinCommentReplies } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { findPinOrFail } from "../../helpers";

/** GET /api/projects/[id]/attachments/[attachmentId]/pins/[pinId]/replies */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { attachmentId, pinId } = params;

    const pinOrError = await findPinOrFail(pinId, attachmentId);
    if (pinOrError instanceof NextResponse) return pinOrError;

    const replies = await getPinCommentReplies(pinId);
    return NextResponse.json(replies);
  }
);
