import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPool } from "@/lib/db";
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

  const pool = getPool();

  // Single CTE query for all stats + deadlines
  const [statsResult, activityResult] = await Promise.all([
    pool.query(
      `WITH project_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM project WHERE org_id = $1
      ),
      review_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE a.review_status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE a.review_status = 'approved')::int AS approved
        FROM attachment a
        JOIN project p ON p.id = a.project_id
        WHERE p.org_id = $1
      ),
      member_count AS (
        SELECT COUNT(*)::int AS count FROM member WHERE "organizationId" = $1
      ),
      upcoming AS (
        SELECT json_agg(row_to_json(d)) AS rows FROM (
          SELECT id, name, client_name, deadline, status
          FROM project
          WHERE org_id = $1 AND status = 'active' AND deadline IS NOT NULL
          ORDER BY deadline ASC
          LIMIT 5
        ) d
      )
      SELECT
        ps.active, ps.completed,
        rs.pending, rs.approved,
        mc.count AS team_members,
        u.rows AS deadlines
      FROM project_stats ps, review_stats rs, member_count mc, upcoming u`,
      [orgId]
    ),
    pool.query(
      `SELECT n.id, n.type, n.title, n.description, n.created_at, p.name AS project_name
       FROM notification n
       LEFT JOIN project p ON p.id = n.project_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 10`,
      [user.id]
    ),
  ]);

  const s = statsResult.rows[0];

  return NextResponse.json({
    stats: {
      active: s?.active ?? 0,
      pendingReviews: s?.pending ?? 0,
      approved: s?.approved ?? 0,
      teamMembers: s?.team_members ?? 0,
    },
    deadlines: s?.deadlines ?? [],
    recentActivity: activityResult.rows,
  });
});
