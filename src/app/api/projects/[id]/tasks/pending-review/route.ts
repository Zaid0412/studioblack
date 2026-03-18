import { NextResponse } from "next/server";
import { getTasksPendingReview } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/tasks/pending-review — tasks awaiting client review. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id } = params;

    const tasks = await getTasksPendingReview(id);
    return NextResponse.json(tasks);
  }
);
