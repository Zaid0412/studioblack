import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPool } from "@/lib/db";

/** GET /api/dashboard — stats + recent activity for the current user's org. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const pool = getPool();

  // Stats queries in parallel
  const [projectStats, reviewStats, memberCount, deadlines, activity] =
    await Promise.all([
      // Project counts by status
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM project WHERE org_id = $1`,
        [orgId]
      ),
      // Attachment review counts
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE a.review_status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE a.review_status = 'approved')::int AS approved
        FROM attachment a
        JOIN project p ON p.id = a.project_id
        WHERE p.org_id = $1`,
        [orgId]
      ),
      // Team member count
      pool.query(
        `SELECT COUNT(*)::int AS count FROM member WHERE "organizationId" = $1`,
        [orgId]
      ),
      // Upcoming deadlines (active projects with deadlines)
      pool.query(
        `SELECT id, name, client_name, deadline, status
        FROM project
        WHERE org_id = $1 AND status = 'active' AND deadline IS NOT NULL
        ORDER BY deadline ASC
        LIMIT 5`,
        [orgId]
      ),
      // Recent activity from notifications (org-wide, last 10)
      pool.query(
        `SELECT n.id, n.type, n.title, n.description, n.created_at, p.name AS project_name
        FROM notification n
        LEFT JOIN project p ON p.id = n.project_id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 10`,
        [session.user.id]
      ),
    ]);

  return NextResponse.json({
    stats: {
      active: projectStats.rows[0]?.active ?? 0,
      pendingReviews: reviewStats.rows[0]?.pending ?? 0,
      approved: reviewStats.rows[0]?.approved ?? 0,
      teamMembers: memberCount.rows[0]?.count ?? 0,
    },
    deadlines: deadlines.rows,
    recentActivity: activity.rows,
  });
}
