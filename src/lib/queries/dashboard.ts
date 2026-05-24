import { getPool } from "@/lib/db";

/**
 * One row in the dashboard's "Pending Reviews" popover. Mirrors the count
 * from `getDashboardStats` (project-scoped attachments with
 * `review_status = 'pending'`); standalone task attachments are excluded.
 */
export interface PendingReviewRow {
  id: string;
  project_id: string;
  project_name: string;
  file_name: string;
  version: number;
  uploaded_at: string;
  uploaded_by_name: string | null;
}

/** Org-wide list of attachments awaiting review, newest first. */
export async function getPendingReviews(
  orgId: string,
  limit = 20
): Promise<PendingReviewRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       a.id,
       a.project_id,
       p.name AS project_name,
       a.file_name,
       a.version,
       a.created_at AS uploaded_at,
       u.name AS uploaded_by_name
     FROM attachment a
     JOIN project p ON p.id = a.project_id
     LEFT JOIN "user" u ON u.id = a.uploaded_by
     WHERE p.org_id = $1
       AND a.review_status = 'pending'
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $2`,
    [orgId, limit]
  );
  return rows as PendingReviewRow[];
}

/**
 * One row in the "BOQs" section of the dashboard's pending reviews popover.
 * Mirrors `getPendingReviews` shape so the popover can render both lists with
 * the same row component.
 */
export interface PendingBoqReviewRow {
  id: string;
  project_id: string;
  project_name: string;
  /** Most-recent item update on this BOQ — used to order the popover. */
  submitted_at: string;
  /** Number of items in `internal_review` on this BOQ — surfaced in the popover. */
  items_in_review: number;
}

/**
 * Org-wide list of BOQs that have ≥1 item in `internal_review`, newest first.
 *
 * A BOQ shows up once any of its items is waiting on internal sign-off.
 * Items themselves are not surfaced individually — the unit of "review work"
 * stays at BOQ granularity for the popover.
 */
export async function getPendingBoqReviews(
  orgId: string,
  limit = 20
): Promise<PendingBoqReviewRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       b.id,
       b.project_id,
       p.name AS project_name,
       MAX(bi.updated_at) AS submitted_at,
       COUNT(bi.id)::int AS items_in_review
     FROM boq b
     JOIN project p ON p.id = b.project_id
     JOIN boq_item bi ON bi.boq_id = b.id
     WHERE p.org_id = $1
       AND bi.phase = 'internal_review'
     GROUP BY b.id, b.project_id, p.name
     ORDER BY MAX(bi.updated_at) DESC NULLS LAST, b.id DESC
     LIMIT $2`,
    [orgId, limit]
  );
  return rows as PendingBoqReviewRow[];
}

/**
 * One row in the client dashboard's "Pending Reviews" popover.
 *
 * A file shows up when it's been sent to the client and the review_status
 * is still 'pending' — i.e. the client owes a decision. Once they approve
 * or request changes, `review_status` flips and the row drops out.
 */
export interface ClientPendingFileRow {
  id: string;
  project_id: string;
  project_name: string;
  file_name: string;
  version: number;
  sent_at: string;
}

/**
 * One row in the "BOQs" section of the client's pending-reviews popover.
 * A BOQ shows up while any of its items sits at `sent_to_client` or
 * `client_reviewing` — i.e. the client still owes a decision.
 */
export interface ClientPendingBoqRow {
  id: string;
  project_id: string;
  project_name: string;
  submitted_at: string;
  items_in_review: number;
}

/**
 * Files + BOQs awaiting the client's decision, scoped to the projects
 * assigned to their email. Archived projects are excluded — matches the
 * filter applied by `getProjectsByClientEmail` so the popover can't
 * deep-link to a project the client wouldn't see anywhere else.
 *
 * `total` is the un-capped count of pending items (files + boqs) and
 * powers the dashboard stat card; the row arrays are capped at `limit`
 * so the popover doesn't render an unbounded list.
 */
export async function getClientPendingReviews(
  email: string,
  limit = 20
): Promise<{
  files: ClientPendingFileRow[];
  boqs: ClientPendingBoqRow[];
  total: number;
}> {
  const pool = getPool();
  const [{ rows: files }, { rows: boqs }, { rows: totals }] = await Promise.all(
    [
      pool.query(
        `SELECT
         a.id,
         a.project_id,
         p.name AS project_name,
         a.file_name,
         a.version,
         a.sent_to_client_at AS sent_at
       FROM attachment a
       JOIN project p ON p.id = a.project_id
       WHERE p.client_email = $1
         AND p.status != 'archived'
         AND a.sent_to_client_at IS NOT NULL
         AND a.review_status = 'pending'
       ORDER BY a.sent_to_client_at DESC, a.id DESC
       LIMIT $2`,
        [email, limit]
      ),
      pool.query(
        `SELECT
         b.id,
         b.project_id,
         p.name AS project_name,
         MAX(bi.updated_at) AS submitted_at,
         COUNT(bi.id)::int AS items_in_review
       FROM boq b
       JOIN project p ON p.id = b.project_id
       JOIN boq_item bi ON bi.boq_id = b.id
       WHERE p.client_email = $1
         AND p.status != 'archived'
         AND bi.phase IN ('sent_to_client', 'client_reviewing')
       GROUP BY b.id, b.project_id, p.name
       ORDER BY MAX(bi.updated_at) DESC NULLS LAST, b.id DESC
       LIMIT $2`,
        [email, limit]
      ),
      pool.query(
        `SELECT
         (SELECT COUNT(*)::int
          FROM attachment a
          JOIN project p ON p.id = a.project_id
          WHERE p.client_email = $1
            AND p.status != 'archived'
            AND a.sent_to_client_at IS NOT NULL
            AND a.review_status = 'pending')
         +
         (SELECT COUNT(DISTINCT bi.boq_id)::int
          FROM boq_item bi
          JOIN boq b ON b.id = bi.boq_id
          JOIN project p ON p.id = b.project_id
          WHERE p.client_email = $1
            AND p.status != 'archived'
            AND bi.phase IN ('sent_to_client', 'client_reviewing'))
         AS total`,
        [email]
      ),
    ]
  );
  return {
    files: files as ClientPendingFileRow[],
    boqs: boqs as ClientPendingBoqRow[],
    total: totals[0]?.total ?? 0,
  };
}

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
    boq_review_stats AS (
      SELECT COUNT(DISTINCT bi.boq_id)::int AS pending
      FROM boq_item bi
      JOIN boq b ON b.id = bi.boq_id
      JOIN project p ON p.id = b.project_id
      WHERE p.org_id = $1 AND bi.phase = 'internal_review'
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
      (rs.pending + brs.pending) AS pending,
      rs.approved,
      mc.count AS team_members,
      u.rows AS deadlines
    FROM project_stats ps, review_stats rs, boq_review_stats brs, member_count mc, upcoming u`,
    [orgId]
  );
  return rows[0];
}
