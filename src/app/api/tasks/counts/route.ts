import { NextResponse } from "next/server";
import { getTaskBucketCounts, getMemberRole } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/tasks/counts — bucket counts for the sidebar badges.
 *
 * Split from `/api/tasks` so the 3-query count bundle doesn't refire on
 * every paginated list request (counts only change on writes). The list
 * page fetches this with a longer SWR dedupe and `mutate()`s it
 * explicitly after a write.
 */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }) => {
    if (!orgId) {
      return NextResponse.json({ counts: {} });
    }

    const memberRole = await getMemberRole(orgId, user.id);
    if (!memberRole) {
      return NextResponse.json({ counts: {} });
    }
    const isArchitect = memberRole === "member";

    const counts = await getTaskBucketCounts(orgId, user.id, isArchitect);
    return NextResponse.json({
      counts,
      role: isArchitect ? "architect" : "pm",
    });
  }
);
