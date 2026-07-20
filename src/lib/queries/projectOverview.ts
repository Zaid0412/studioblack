import { getPool } from "@/lib/db";
import { isExternalViewer } from "@/lib/roles";
import type { UserRole } from "@/types";
import type {
  ProjectOverview,
  OverviewStatusSlice,
  OverviewBar,
  OverviewActivityItem,
} from "@/types";
import { BOQ_SELL_PRICE_SQL } from "./boq";

/**
 * Aggregate the project Overview dashboard for one project, scoped to the
 * viewer's role. Studios (pm/architect) see the full picture — internal
 * uploads, sell-side BOQ value, RFQ count, cost-by-division. External viewers
 * (client) only ever see files that were sent to them, the client-scrubbed
 * BOQ total, no procurement, and a per-phase design-progress chart.
 *
 * Project details + team are NOT here — the layout already fetches
 * `/api/projects/[id]`, so the Overview page reads them from that SWR cache.
 */
export async function getProjectOverview(
  projectId: string,
  role: UserRole
): Promise<ProjectOverview> {
  const pool = getPool();
  const clientOnly = isExternalViewer(role);
  // Constant SQL fragment (no user input) — gates external viewers to files
  // that were actually sent to them.
  const sentGate = clientOnly ? "AND a.sent_to_client_at IS NOT NULL" : "";

  const [statusRes, chartBars, activity, boqAgg, openOrders] =
    await Promise.all([
      // Design-status breakdown over the latest version of each file.
      pool.query<OverviewStatusSlice>(
        `SELECT la.review_status AS status, COUNT(*)::int AS count
       FROM (
         SELECT DISTINCT ON (a.version_group) a.version_group, a.review_status
         FROM attachment a
         WHERE a.project_id = $1 ${sentGate}
         ORDER BY a.version_group, a.version DESC
       ) la
       GROUP BY la.review_status`,
        [projectId]
      ),
      clientOnly ? designProgressByPhase(projectId) : costByDivision(projectId),
      recentActivity(projectId, sentGate),
      // Latest BOQ's sell-side total + line count in one query. The Overview only
      // needs these two numbers (plus the pcts to derive the client total), so it
      // skips the full `getBoqSummary` (section totals + margin/budget aggregates).
      pool
        .query<{
          total_sell_price: number;
          item_count: number;
          contingency_pct: string;
          vat_pct: string;
        }>(
          `WITH latest AS (
           SELECT id, contingency_pct, vat_pct FROM boq
           WHERE project_id = $1 ORDER BY version DESC LIMIT 1
         )
         SELECT
           COALESCE(SUM(${BOQ_SELL_PRICE_SQL}) FILTER (WHERE NOT bi.is_excluded), 0)::float8 AS total_sell_price,
           COUNT(bi.id)::int AS item_count,
           l.contingency_pct, l.vat_pct
         FROM latest l
         LEFT JOIN boq_item bi ON bi.boq_id = l.id
         GROUP BY l.id, l.contingency_pct, l.vat_pct`,
          [projectId]
        )
        .then((r) => r.rows[0] ?? null),
      clientOnly
        ? Promise.resolve<number | null>(null)
        : pool
            .query<{ count: number }>(
              `SELECT COUNT(*)::int AS count FROM rfq
             WHERE project_id = $1 AND status <> 'superseded'`,
              [projectId]
            )
            .then((r) => r.rows[0]?.count ?? 0),
    ]);

  const designStatus = statusRes.rows;
  const designFiles = designStatus.reduce((sum, s) => sum + s.count, 0);
  const pendingReviews =
    designStatus.find((s) => s.status === "pending")?.count ?? 0;

  // Client sees the contingency + VAT-inclusive total; studio sees sell-side.
  const boqValue = boqAgg
    ? clientOnly
      ? String(
          boqAgg.total_sell_price *
            (1 + Number(boqAgg.contingency_pct) / 100) *
            (1 + Number(boqAgg.vat_pct) / 100)
        )
      : String(boqAgg.total_sell_price)
    : null;

  return {
    kpis: {
      designFiles,
      pendingReviews,
      boqValue,
      boqLineCount: boqAgg?.item_count ?? 0,
      openOrders,
    },
    designStatus,
    chart: {
      kind: clientOnly ? "design_progress_by_phase" : "cost_by_division",
      bars: chartBars,
    },
    activity,
  };
}

/** Studio chart: sell-side value rolled up per division (non-empty divisions). */
async function costByDivision(projectId: string): Promise<OverviewBar[]> {
  const pool = getPool();
  const { rows } = await pool.query<OverviewBar>(
    `SELECT div.name AS label,
       COALESCE(SUM(${BOQ_SELL_PRICE_SQL}) FILTER (WHERE NOT bi.is_excluded), 0)::float8 AS value
     FROM boq_item bi
     JOIN boq b ON b.id = bi.boq_id
     JOIN division div ON div.id = bi.division_id
     WHERE b.project_id = $1
     GROUP BY div.id, div.name, div.sort_order
     HAVING COALESCE(SUM(${BOQ_SELL_PRICE_SQL}) FILTER (WHERE NOT bi.is_excluded), 0) > 0
     ORDER BY div.sort_order`,
    [projectId]
  );
  return rows;
}

/** Client chart: % of shared files approved, per enabled phase. */
async function designProgressByPhase(
  projectId: string
): Promise<OverviewBar[]> {
  const pool = getPool();
  const { rows } = await pool.query<OverviewBar>(
    `SELECT ph.name AS label,
       CASE WHEN COUNT(la.version_group) = 0 THEN 0
            ELSE ROUND(
              COUNT(la.version_group) FILTER (WHERE la.review_status = 'approved')::numeric
              / COUNT(la.version_group) * 100
            )::int
       END AS value
     FROM project_phase ph
     LEFT JOIN (
       SELECT DISTINCT ON (a.version_group)
         a.version_group, a.phase_id, a.review_status
       FROM attachment a
       WHERE a.project_id = $1 AND a.sent_to_client_at IS NOT NULL
       ORDER BY a.version_group, a.version DESC
     ) la ON la.phase_id = ph.id
     WHERE ph.project_id = $1 AND ph.enabled
     GROUP BY ph.id, ph.name, ph.phase_order
     ORDER BY ph.phase_order`,
    [projectId]
  );
  return rows;
}

/** Recent uploads + review decisions for the project, newest first. */
async function recentActivity(
  projectId: string,
  sentGate: string
): Promise<OverviewActivityItem[]> {
  const pool = getPool();
  const { rows } = await pool.query<OverviewActivityItem>(
    `(SELECT a.id, 'upload' AS kind, u.name AS actor,
        a.file_name AS "fileName", NULL::text AS status, a.created_at AS at
      FROM attachment a
      LEFT JOIN "user" u ON u.id = a.uploaded_by
      WHERE a.project_id = $1 ${sentGate})
     UNION ALL
     (SELECT r.id, 'review' AS kind, u.name AS actor,
        a.file_name AS "fileName", r.status, r.created_at AS at
      FROM attachment_review r
      JOIN attachment a ON a.id = r.attachment_id
      LEFT JOIN "user" u ON u.id = r.reviewer_id
      WHERE a.project_id = $1 ${sentGate})
     ORDER BY at DESC
     LIMIT 8`,
    [projectId]
  );
  return rows;
}
