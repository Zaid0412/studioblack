import { NextResponse } from "next/server";
import { getClientPendingReviews } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/client/pending-reviews — files + BOQs awaiting the caller's
 * decision, scoped to projects where `client_email` matches the session
 * email. Powers the client dashboard's "Pending Reviews" popover.
 */
export const GET = withAuth(
  { allowedRoles: ["client"] },
  async (_req, { user }) => {
    const { files, boqs, total } = await getClientPendingReviews(user.email);
    return NextResponse.json({ files, boqs, total });
  }
);
