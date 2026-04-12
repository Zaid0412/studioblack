import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getDashboardStats, getRecentActivity } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/dashboard — stats + recent activity for the current user's org. */
export const GET = withAuth({}, async (req, { session, user }) => {
  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const orgs = await auth.api.listOrganizations({
      headers: await headers(),
    });
    if (orgs && orgs.length > 0) orgId = orgs[0].id;
  }

  if (!orgId) {
    return NextResponse.json({
      stats: { active: 0, pendingReviews: 0, approved: 0, teamMembers: 0 },
      deadlines: [],
      recentActivity: [],
    });
  }

  const [s, activity] = await Promise.all([
    getDashboardStats(orgId),
    getRecentActivity(user.id, 10),
  ]);

  return NextResponse.json({
    stats: {
      active: s?.active ?? 0,
      pendingReviews: s?.pending ?? 0,
      approved: s?.approved ?? 0,
      teamMembers: s?.team_members ?? 0,
    },
    deadlines: s?.deadlines ?? [],
    recentActivity: activity,
  });
});
