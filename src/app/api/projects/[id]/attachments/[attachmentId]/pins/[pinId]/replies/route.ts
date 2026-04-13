import { NextResponse } from "next/server";
import { getPinCommentReplies } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { findPinOrFail } from "../../helpers";

/** GET /api/projects/[id]/attachments/[attachmentId]/pins/[pinId]/replies */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const pinOrError = await findPinOrFail(params);
    if (pinOrError instanceof NextResponse) return pinOrError;

    const replies = await getPinCommentReplies(params.pinId);
    return NextResponse.json(replies);
  }
);
