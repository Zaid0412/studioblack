import { getPool } from "@/lib/db";
import type {
  Rfq,
  RfqItem,
  RfqVendorInvite,
  RfqListRow,
  RfqStatus,
  RfqWithItems,
  VendorLite,
} from "@/types";
import { escapeSqlLike } from "./helpers";

/**
 * F9 — RFQ Workflow read paths.
 *
 * Mutations (createRfqDraft, updateRfqDraft, issueRfq, cancelRfq) land in
 * Phase B; this module is reads-only.
 */

export interface RfqListFilters {
  status?: RfqStatus;
  search?: string;
  page: number;
  limit: number;
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * Ownership probe used by `/api/projects/[id]/rfqs/[rfqId]/*` routes — the
 * project-access check on `withAuth({ projectAccess: true })` guards the
 * project, but a caller can still pass an `rfqId` from another project.
 */
export async function verifyRfqOwnership(
  rfqId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM rfq WHERE id = $1 AND project_id = $2
     ) AS exists`,
    [rfqId, projectId]
  );
  return rows[0]?.exists ?? false;
}

/**
 * Paged list for the studio RFQ tab. Counts items + invited vendors in a
 * single round-trip via correlated sub-selects — fine at expected list
 * sizes (a few dozen RFQs per project), avoids a join + group-by that
 * doubles rows when an RFQ has multiple items.
 */
export async function getRfqsByProject(
  projectId: string,
  filters: RfqListFilters
): Promise<{ rows: RfqListRow[]; total: number }> {
  const pool = getPool();
  const conditions: string[] = ["r.project_id = $1"];
  const params: unknown[] = [projectId];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${escapeSqlLike(filters.search)}%`);
    const idx = params.length;
    conditions.push(`(r.title ILIKE $${idx} OR r.rfq_number ILIKE $${idx})`);
  }

  const where = conditions.join(" AND ");
  const limit = Math.max(1, Math.min(filters.limit, 200));
  const offset = (Math.max(1, filters.page) - 1) * limit;
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `SELECT
       r.id, r.rfq_number, r.title, r.status,
       r.issued_date, r.response_deadline, r.created_at,
       (SELECT COUNT(*)::int FROM rfq_item ri WHERE ri.rfq_id = r.id) AS item_count,
       (SELECT COUNT(*)::int FROM rfq_vendor rv WHERE rv.rfq_id = r.id) AS vendor_count,
       COUNT(*) OVER ()::int AS total
     FROM rfq r
     WHERE ${where}
     ORDER BY r.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const total = rows[0]?.total ?? 0;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      rfq_number: r.rfq_number,
      title: r.title,
      status: r.status,
      issued_date: r.issued_date,
      response_deadline: r.response_deadline,
      item_count: r.item_count,
      vendor_count: r.vendor_count,
      created_at: r.created_at,
    })),
    total,
  };
}

/**
 * Full RFQ detail — header, items (sorted), and invited vendors. Returns
 * `null` when the RFQ doesn't exist; the caller decides 404 vs 200.
 */
export async function getRfqDetail(
  rfqId: string
): Promise<RfqWithItems | null> {
  const pool = getPool();
  const { rows: rfqRows } = await pool.query<Rfq>(
    `SELECT * FROM rfq WHERE id = $1`,
    [rfqId]
  );
  const rfq = rfqRows[0];
  if (!rfq) return null;

  const { rows: itemRows } = await pool.query<RfqItem>(
    `SELECT id, rfq_id, boq_item_id, description, unit, quantity, spec_notes,
            sort_order, awarded_vendor_id, awarded_quote_item_id
     FROM rfq_item
     WHERE rfq_id = $1
     ORDER BY sort_order, description`,
    [rfqId]
  );

  const { rows: vendorRows } = await pool.query<RfqVendorInvite>(
    `SELECT rv.rfq_id, rv.vendor_id, v.company_name AS vendor_name,
            v.vendor_code, rv.invited_at, rv.invited_by
     FROM rfq_vendor rv
     JOIN vendor v ON v.id = rv.vendor_id
     WHERE rv.rfq_id = $1
     ORDER BY lower(v.company_name)`,
    [rfqId]
  );

  return {
    ...rfq,
    items: itemRows.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    vendors: vendorRows,
  };
}

/**
 * Suggest vendors for an RFQ based on the trades they've registered against
 * its items' element categories. `element_category` is a 3-level tree, and
 * vendors can register at any level, so we walk parents from each item's
 * category up to root and match `vendor_trade.category_id` against the full
 * ancestor set. Org-scoped + active-only.
 */
export async function getSuggestedVendorsForRfq(
  rfqId: string
): Promise<VendorLite[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH RECURSIVE item_cats AS (
       SELECT DISTINCT e.category_id
       FROM rfq_item ri
       JOIN boq_item bi ON bi.id = ri.boq_item_id
       JOIN element e ON e.id = bi.element_id
       WHERE ri.rfq_id = $1 AND e.category_id IS NOT NULL
     ),
     cat_ancestors AS (
       SELECT category_id AS id FROM item_cats
       UNION
       SELECT ec.parent_id FROM element_category ec
       JOIN cat_ancestors ca ON ec.id = ca.id
       WHERE ec.parent_id IS NOT NULL
     )
     SELECT DISTINCT
       v.id, v.company_name, v.vendor_code, v.status, v.rating,
       (SELECT email FROM vendor_contact
        WHERE vendor_id = v.id AND is_primary = true LIMIT 1) AS primary_contact_email
     FROM vendor v
     JOIN vendor_trade vt ON vt.vendor_id = v.id
     WHERE vt.category_id IN (SELECT id FROM cat_ancestors)
       AND v.status = 'active'
       AND v.org_id = (SELECT org_id FROM rfq WHERE id = $1)
     ORDER BY v.rating DESC NULLS LAST, lower(v.company_name)`,
    [rfqId]
  );
  return rows as VendorLite[];
}

// ── Vendor-portal reads ─────────────────────────────────────────────────────

/**
 * RFQs visible to a single vendor — they must be on the `rfq_vendor`
 * invitation list AND the RFQ must be in a vendor-visible status (i.e.
 * not `draft` or `cancelled`). Sorted newest-issued first.
 */
export async function getRfqsForVendor(
  vendorId: string,
  filters: { status?: RfqStatus; page: number; limit: number }
): Promise<{ rows: RfqListRow[]; total: number }> {
  const pool = getPool();
  const conditions: string[] = [
    "rv.vendor_id = $1",
    "r.status NOT IN ('draft','cancelled')",
  ];
  const params: unknown[] = [vendorId];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`r.status = $${params.length}`);
  }

  const where = conditions.join(" AND ");
  const limit = Math.max(1, Math.min(filters.limit, 200));
  const offset = (Math.max(1, filters.page) - 1) * limit;
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `SELECT
       r.id, r.rfq_number, r.title, r.status,
       r.issued_date, r.response_deadline, r.created_at,
       (SELECT COUNT(*)::int FROM rfq_item ri WHERE ri.rfq_id = r.id) AS item_count,
       (SELECT COUNT(*)::int FROM rfq_vendor rv2 WHERE rv2.rfq_id = r.id) AS vendor_count,
       COUNT(*) OVER ()::int AS total
     FROM rfq r
     JOIN rfq_vendor rv ON rv.rfq_id = r.id
     WHERE ${where}
     ORDER BY r.issued_date DESC NULLS LAST, r.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    rows: rows.map((r) => ({
      id: r.id,
      rfq_number: r.rfq_number,
      title: r.title,
      status: r.status,
      issued_date: r.issued_date,
      response_deadline: r.response_deadline,
      item_count: r.item_count,
      vendor_count: r.vendor_count,
      created_at: r.created_at,
    })),
    total: rows[0]?.total ?? 0,
  };
}

/**
 * Vendor-scoped RFQ detail. Returns `null` when the RFQ doesn't exist OR the
 * vendor isn't on its `rfq_vendor` list — the caller 404s without disclosing
 * which case it was (don't let vendors probe for RFQ ids they weren't invited
 * to). The `vendors` field is intentionally NOT included for vendors — they
 * don't see who else was invited (competitive info).
 */
export async function getRfqDetailForVendor(
  rfqId: string,
  vendorId: string
): Promise<Omit<RfqWithItems, "vendors"> | null> {
  const pool = getPool();
  const { rows: rfqRows } = await pool.query<Rfq>(
    `SELECT r.* FROM rfq r
     JOIN rfq_vendor rv ON rv.rfq_id = r.id
     WHERE r.id = $1 AND rv.vendor_id = $2
       AND r.status NOT IN ('draft','cancelled')`,
    [rfqId, vendorId]
  );
  const rfq = rfqRows[0];
  if (!rfq) return null;

  const { rows: itemRows } = await pool.query<RfqItem>(
    `SELECT id, rfq_id, boq_item_id, description, unit, quantity, spec_notes,
            sort_order, awarded_vendor_id, awarded_quote_item_id
     FROM rfq_item
     WHERE rfq_id = $1
     ORDER BY sort_order, description`,
    [rfqId]
  );

  return {
    ...rfq,
    items: itemRows.map((i) => ({ ...i, quantity: Number(i.quantity) })),
  };
}
