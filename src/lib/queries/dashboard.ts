import { getPool } from "@/lib/db";

/** Get dashboard stats (active projects, reviews, team members, upcoming deadlines). */
export async function getDashboardStats(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
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
  );
  return rows[0];
}
