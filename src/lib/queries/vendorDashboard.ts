import { getPool } from "@/lib/db";
import {
  QUOTE_OUTCOME_BUCKET,
  type VendorQuoteStatus,
} from "@/lib/validations";
import type {
  VendorDashboard,
  VendorQuoteOutcome,
  VendorAwaitingRfq,
} from "@/types";

/** Sum current-quote counts whose status rolls up to `bucket`. */
function sumBucket(
  outcomes: VendorQuoteOutcome[],
  bucket: "won" | "lost" | "pending"
): number {
  return outcomes.reduce(
    (n, o) =>
      n +
      (QUOTE_OUTCOME_BUCKET[o.status as VendorQuoteStatus] === bucket
        ? o.count
        : 0),
    0
  );
}

/** RFQ statuses a vendor can still act on — the same set the portal list uses. */
const OPEN_RFQ_STATUSES = ["issued", "quotes_received", "under_review"];

/**
 * Aggregate the vendor-portal dashboard for one vendor. Everything is scoped to
 * `vendorId` (resolved from the caller's `vendor_contact` link, never trusted
 * from the request). Mirrors `getProjectOverview`: a `Promise.all` of a few
 * parameterized reads, then the KPI tiles are derived in JS.
 *
 * Only three reads run — the KPI counts (`quotesUnderReview`, `awarded`,
 * `winRate`) all fall out of the `outcomes` GROUP BY, so there's no separate
 * query per tile.
 */
export async function getVendorDashboard(
  vendorId: string
): Promise<VendorDashboard> {
  const pool = getPool();

  // Shared predicate: an open RFQ this vendor was invited to but hasn't
  // responded to yet (no current quote row). Same shape as `getDueRfqReminders`.
  const awaitingWhere = `rv.vendor_id = $1
       AND r.status = ANY($2)
       AND NOT EXISTS (
         SELECT 1 FROM vendor_quote vq
         WHERE vq.rfq_id = rv.rfq_id
           AND vq.vendor_id = rv.vendor_id
           AND vq.is_current
       )`;

  const [openRes, outcomeRes, awaitingRes] = await Promise.all([
    pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM rfq r
       JOIN rfq_vendor rv ON rv.rfq_id = r.id
       WHERE ${awaitingWhere}`,
      [vendorId, OPEN_RFQ_STATUSES]
    ),
    pool.query<VendorQuoteOutcome>(
      `SELECT status, COUNT(*)::int AS count
       FROM vendor_quote
       WHERE vendor_id = $1 AND is_current
       GROUP BY status`,
      [vendorId]
    ),
    pool.query<VendorAwaitingRfq>(
      `SELECT r.id, r.rfq_number, r.title,
         (SELECT COUNT(*)::int FROM rfq_item ri WHERE ri.rfq_id = r.id) AS item_count,
         r.response_deadline
       FROM rfq r
       JOIN rfq_vendor rv ON rv.rfq_id = r.id
       WHERE ${awaitingWhere}
       ORDER BY r.response_deadline ASC NULLS LAST
       LIMIT 5`,
      [vendorId, OPEN_RFQ_STATUSES]
    ),
  ]);

  const outcomes = outcomeRes.rows;

  return {
    kpis: {
      openRfqs: openRes.rows[0]?.count ?? 0,
      quotesUnderReview: sumBucket(outcomes, "pending"),
      awarded: sumBucket(outcomes, "won"),
      winRate: winRateFromOutcomes(outcomes),
    },
    outcomes,
    awaitingRfqs: awaitingRes.rows,
  };
}

/**
 * Integer win-rate percent: won quotes over all *decided* quotes (won + lost,
 * per `QUOTE_OUTCOME_BUCKET`). 0 when nothing has been decided. Pure so it can
 * be unit-tested without a DB.
 */
export function winRateFromOutcomes(outcomes: VendorQuoteOutcome[]): number {
  const won = sumBucket(outcomes, "won");
  const decided = won + sumBucket(outcomes, "lost");
  return decided === 0 ? 0 : Math.round((won / decided) * 100);
}
