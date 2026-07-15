import { getPool } from "@/lib/db";
import type {
  Rfq,
  RfqEvent,
  RfqItem,
  RfqItemBoqChange,
  RfqVendorInvite,
  RfqListRow,
  RfqStatus,
  RfqWithItems,
  VendorLite,
} from "@/types";
import { escapeSqlLike } from "./helpers";
import { BOQ_SELL_PRICE_SQL } from "./boq";
import { DOC_TYPES, nextDocumentNumber } from "./sequences";
import { mapPgError } from "./_pgErrors";
import { AUDIT_ACTIONS } from "@/lib/auditConstants";
import {
  QUOTE_SUBMITTABLE_RFQ_STATUSES,
  RFQ_ELIGIBLE_PHASES,
  RFQ_INVITEABLE_STATUSES,
  RFQ_REVISABLE_STATUSES,
  RFQ_TERMINAL_STATUSES,
} from "@/lib/validations";

/** F9 — RFQ Workflow query layer (reads + mutations + email-fan-out helpers). */

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
): Promise<{ rows: RfqListRow[]; total: number; readyNotInRfq: number }> {
  const pool = getPool();
  const conditions: string[] = ["r.project_id = $1"];
  const params: unknown[] = [projectId];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`r.status = $${params.length}`);
  } else {
    // Superseded RFQs are reachable via the "· supersedes" link on their
    // revision; keep them out of the default list so it shows one row per chain.
    conditions.push(`r.status <> 'superseded'`);
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

  // The paged list and the project-global "ready, not in an RFQ" count are
  // independent — run them in one round-trip. (The count can't fold into the
  // list query: an empty list has no row to carry it, which is exactly when
  // the nudge matters most — a project with ready items but no RFQs yet.)
  const [listRes, readyRes] = await Promise.all([
    pool.query(
      `SELECT
         r.id, r.rfq_number, r.title, r.status, r.revision_number,
         r.issued_date, r.response_deadline, r.created_at,
         (SELECT COUNT(*)::int FROM rfq_item ri WHERE ri.rfq_id = r.id) AS item_count,
         (SELECT COUNT(*)::int FROM rfq_vendor rv WHERE rv.rfq_id = r.id) AS vendor_count,
         (SELECT COUNT(DISTINCT vq.vendor_id)::int
          FROM vendor_quote vq
          WHERE vq.rfq_id = r.id AND vq.is_current) AS responded_count,
         (SELECT MAX(vq.submitted_at)
          FROM vendor_quote vq
          WHERE vq.rfq_id = r.id AND vq.is_current
            AND vq.status <> 'declined') AS latest_quote_submitted_at,
         COUNT(*) OVER ()::int AS total
       FROM rfq r
       WHERE ${where}
       ORDER BY r.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    ),
    // RFQ-3d: ready-for-procurement items not on any live RFQ (a draft keeps
    // po_status='none', so check RFQ membership directly rather than po_status).
    pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM boq_item bi
         JOIN boq b ON b.id = bi.boq_id
        WHERE b.project_id = $1
          AND bi.phase = ANY($2::text[])
          AND NOT bi.is_excluded
          AND NOT EXISTS (
            SELECT 1 FROM rfq_item ri
            JOIN rfq r ON r.id = ri.rfq_id
            WHERE ri.boq_item_id = bi.id
              AND r.status NOT IN ('cancelled', 'superseded')
          )`,
      [projectId, [...RFQ_ELIGIBLE_PHASES]]
    ),
  ]);

  const rows = listRes.rows;
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
      responded_count: r.responded_count,
      created_at: r.created_at,
      latest_quote_submitted_at: r.latest_quote_submitted_at ?? null,
      revision_number: r.revision_number,
    })),
    total,
    readyNotInRfq: readyRes.rows[0]?.n ?? 0,
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

  // Items, vendors, and events are independent of each other and of the
  // header beyond the rfqId — fetch in parallel to cut detail-page latency
  // from 4 sequential RTTs to ~max-of-3.
  const [itemRes, vendorRes, events, chainRes] = await Promise.all([
    pool.query<
      RfqItem & {
        boq_quantity: string;
        boq_description: string;
        boq_unit: string;
        boq_excluded: boolean;
      }
    >(
      // Join the live boq_item so the detail read can flag divergence (RFQ-3c)
      // and scope removal (RFQ-3d).
      `SELECT ri.id, ri.rfq_id, ri.boq_item_id, ri.description, ri.unit,
              ri.quantity, ri.spec_notes, ri.sort_order, ri.proposed_price,
              ri.attachments, ri.awarded_vendor_id, ri.awarded_quote_item_id,
              bi.quantity AS boq_quantity, bi.description AS boq_description,
              bi.unit AS boq_unit, bi.is_excluded AS boq_excluded
       FROM rfq_item ri
       JOIN boq_item bi ON bi.id = ri.boq_item_id
       WHERE ri.rfq_id = $1
       ORDER BY ri.sort_order, ri.description`,
      [rfqId]
    ),
    pool.query<RfqVendorInvite>(
      `SELECT rv.rfq_id, rv.vendor_id, v.company_name AS vendor_name,
              v.vendor_code, rv.invited_at, rv.invited_by,
              u.name AS invited_by_name, rv.distribution_method,
              rv.contact_name
       FROM rfq_vendor rv
       JOIN vendor v ON v.id = rv.vendor_id
       LEFT JOIN "user" u ON u.id = rv.invited_by
       WHERE rv.rfq_id = $1
       ORDER BY lower(v.company_name)`,
      [rfqId]
    ),
    getRfqEvents(rfqId),
    // Revision chain: the RFQ this one revised (parent) + the revision that
    // superseded it (child), for the detail-page banners. One round-trip.
    pool.query<{
      id: string;
      rfq_number: string;
      revision_number: number;
      rel: "parent" | "child";
    }>(
      // `id = $2` is false when $2 (supersedes_rfq_id) is NULL, so no explicit
      // guard is needed — an original RFQ simply matches no parent row.
      `SELECT id, rfq_number, revision_number,
              CASE WHEN id = $2 THEN 'parent' ELSE 'child' END AS rel
       FROM rfq
       WHERE id = $2 OR supersedes_rfq_id = $1`,
      [rfqId, rfq.supersedes_rfq_id]
    ),
  ]);

  const chainRef = (rel: "parent" | "child") => {
    const r = chainRes.rows.find((row) => row.rel === rel);
    return r
      ? {
          id: r.id,
          rfq_number: r.rfq_number,
          revision_number: r.revision_number,
        }
      : null;
  };

  // Divergence only matters while the RFQ is live (vendors are quoting against
  // the snapshot). Draft/terminal RFQs don't surface it.
  const inFlight = (
    QUOTE_SUBMITTABLE_RFQ_STATUSES as readonly string[]
  ).includes(rfq.status);

  return {
    ...rfq,
    items: itemRes.rows.map((r) => {
      const { boq_quantity, boq_description, boq_unit, boq_excluded, ...item } =
        r;
      const quantity = Number(item.quantity);
      // A removed (excluded) item can't also diverge on qty/spec — surface it
      // only as removed so the banner routes it to a revision, not a sync.
      const boq_removed = inFlight ? boq_excluded : undefined;
      const boq_changes =
        inFlight && !boq_excluded
          ? boqDivergence(
              { description: item.description, unit: item.unit, quantity },
              {
                description: boq_description,
                unit: boq_unit,
                quantity: Number(boq_quantity),
              }
            )
          : undefined;
      return { ...item, quantity, boq_changes, boq_removed };
    }),
    vendors: vendorRes.rows,
    events,
    supersedes: chainRef("parent"),
    superseded_by: chainRef("child"),
  };
}

type BoqItemSnapshot = { description: string; unit: string; quantity: number };
const BOQ_DIVERGENCE_FIELDS = ["quantity", "description", "unit"] as const;

/** Fields where the live BOQ item differs from the RFQ's snapshot (RFQ-3c). */
export function boqDivergence(
  snapshot: BoqItemSnapshot,
  live: BoqItemSnapshot
): RfqItemBoqChange[] {
  const changes: RfqItemBoqChange[] = [];
  for (const field of BOQ_DIVERGENCE_FIELDS) {
    if (snapshot[field] !== live[field]) {
      changes.push({ field, from: snapshot[field], to: live[field] });
    }
  }
  return changes;
}

/**
 * PRD §17: the display name of a vendor invited to this RFQ, or null if the
 * vendor isn't on the RFQ (so a logged communication can't reference an
 * unrelated vendor). Used to denormalise `vendor_name` into the audit metadata
 * the timeline renders.
 */
export async function getRfqVendorName(
  rfqId: string,
  vendorId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ company_name: string }>(
    `SELECT v.company_name
       FROM rfq_vendor rv JOIN vendor v ON v.id = rv.vendor_id
      WHERE rv.rfq_id = $1 AND rv.vendor_id = $2`,
    [rfqId, vendorId]
  );
  return rows[0]?.company_name ?? null;
}

/**
 * Audit events for an RFQ, joined with `user.name` so the timeline can show
 * "Issued by Zaid" without a second round-trip. Ordered oldest-first so a
 * client renders top-to-bottom as the story unfolded. `rfq.updated` is
 * excluded — the timeline doesn't have a renderer for it yet.
 *
 * For `rfq.issued` events we also backfill `vendor_names` from the vendor
 * table so the timeline can render the actual company names instead of
 * UUID slugs. Older audit rows (pre-vendor_names metadata) and rows where
 * the issue route couldn't capture a name (vendor without a receives_rfq
 * contact) both get resolved here.
 */
const RFQ_TIMELINE_ACTIONS = [
  AUDIT_ACTIONS.RFQ_CREATED,
  AUDIT_ACTIONS.RFQ_ISSUED,
  AUDIT_ACTIONS.RFQ_VENDORS_ADDED,
  AUDIT_ACTIONS.RFQ_CANCELLED,
  AUDIT_ACTIONS.RFQ_AWARDED,
  AUDIT_ACTIONS.RFQ_REVISED,
  AUDIT_ACTIONS.RFQ_COMMUNICATION_LOGGED,
] as const;
const QUOTE_TIMELINE_ACTIONS = [
  AUDIT_ACTIONS.QUOTE_SUBMITTED,
  AUDIT_ACTIONS.QUOTE_REVISED,
  AUDIT_ACTIONS.QUOTE_AWARDED,
] as const;
const VENDOR_BEARING_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.RFQ_ISSUED,
  AUDIT_ACTIONS.RFQ_VENDORS_ADDED,
]);
/**
 * Studio-internal audit actions that must never surface in the vendor portal.
 * A logged communication carries free-text `remarks` and can name a specific
 * (possibly competing) vendor — it's a private studio note, not vendor-facing.
 */
const STUDIO_ONLY_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.RFQ_COMMUNICATION_LOGGED,
]);

async function getRfqEvents(rfqId: string): Promise<RfqEvent[]> {
  const pool = getPool();
  // Pulls rfq.* events targeting this RFQ AND quote.* events whose
  // metadata.rfq_id matches (we don't have a target_id on quote rows
  // that points back at the rfq, so the join is via JSONB metadata).
  const { rows } = await pool.query(
    `SELECT ae.id, ae.action, ae.created_at, ae.actor_id, u.name AS actor_name,
            ae.metadata
     FROM audit_event ae
     LEFT JOIN "user" u ON u.id = ae.actor_id
     WHERE (
        (ae.target_table = 'rfq'
         AND ae.target_id = $1::uuid
         AND ae.action = ANY($2::text[]))
        OR
        (ae.target_table = 'vendor_quote'
         AND ae.action = ANY($3::text[])
         AND ae.metadata->>'rfq_id' = $1::text)
     )
     -- Latest 100, newest-first (reversed to ascending below). Caps a
     -- heavily-revised RFQ's timeline, matching the LIMIT 100 used by
     -- getBoqItemHistory / getRateContractHistory. The ae.id tiebreaker keeps
     -- ordering stable for events sharing a created_at.
     ORDER BY ae.created_at DESC, ae.id DESC
     LIMIT 100`,
    [rfqId, RFQ_TIMELINE_ACTIONS, QUOTE_TIMELINE_ACTIONS]
  );

  // Collect vendor IDs across all events with vendor metadata that are
  // missing names so we can resolve them with a single batched lookup.
  const missingIds = new Set<string>();
  for (const r of rows) {
    if (!VENDOR_BEARING_ACTIONS.has(r.action) || !r.metadata) continue;
    const ids = Array.isArray(r.metadata.vendor_ids)
      ? (r.metadata.vendor_ids as string[])
      : [];
    const names = Array.isArray(r.metadata.vendor_names)
      ? (r.metadata.vendor_names as (string | null)[])
      : [];
    ids.forEach((id, i) => {
      if (typeof id === "string" && !names[i]) missingIds.add(id);
    });
  }
  let nameById = new Map<string, string>();
  if (missingIds.size > 0) {
    const { rows: vendorRows } = await pool.query<{
      id: string;
      company_name: string;
    }>(`SELECT id, company_name FROM vendor WHERE id = ANY($1::uuid[])`, [
      Array.from(missingIds),
    ]);
    nameById = new Map(vendorRows.map((v) => [v.id, v.company_name]));
  }

  const events = rows.map((r) => {
    let metadata = r.metadata ?? null;
    if (VENDOR_BEARING_ACTIONS.has(r.action) && metadata) {
      const ids = Array.isArray(metadata.vendor_ids)
        ? (metadata.vendor_ids as string[])
        : [];
      const existing = Array.isArray(metadata.vendor_names)
        ? (metadata.vendor_names as (string | null)[])
        : [];
      const resolved = ids.map(
        (id, i) => existing[i] ?? nameById.get(id) ?? null
      );
      metadata = { ...metadata, vendor_names: resolved };
    }
    return {
      id: r.id,
      action: r.action,
      createdAt: r.created_at,
      actorId: r.actor_id,
      actorName: r.actor_name,
      metadata,
    };
  });

  // Reverse to oldest→newest for the timeline (query fetched newest-first).
  return events.reverse();
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
       -- Effective service area per line: the RFQ snapshot's own category, else
       -- the BOQ item's category, else the element's. A free-text line (no
       -- element) still contributes via its category — a LEFT JOIN, not INNER.
       SELECT DISTINCT COALESCE(ri.category_id, bi.category_id, e.category_id) AS category_id
       FROM rfq_item ri
       JOIN boq_item bi ON bi.id = ri.boq_item_id
       LEFT JOIN element e ON e.id = bi.element_id
       WHERE ri.rfq_id = $1
         AND COALESCE(ri.category_id, bi.category_id, e.category_id) IS NOT NULL
     ),
     cat_ancestors AS (
       SELECT category_id AS id FROM item_cats
       UNION
       SELECT ec.parent_id FROM element_category ec
       JOIN cat_ancestors ca ON ec.id = ca.id
       WHERE ec.parent_id IS NOT NULL
     ),
     -- DISTINCT inside a CTE so the outer ORDER BY can reference
     -- expressions (lower(company_name)) without Postgres rejecting it
     -- with "ORDER BY expressions must appear in select list".
     matches AS (
       SELECT DISTINCT
         v.id, v.company_name, v.vendor_code, v.status,
         v.rating::float8 AS rating, v.preferred_vendor,
         (SELECT email FROM vendor_contact
          WHERE vendor_id = v.id AND is_primary = true LIMIT 1) AS primary_contact_email
       FROM vendor v
       JOIN vendor_trade vt ON vt.vendor_id = v.id
       WHERE vt.category_id IN (SELECT id FROM cat_ancestors)
         AND v.status = 'active'
         AND v.org_id = (SELECT org_id FROM rfq WHERE id = $1)
     )
     SELECT * FROM matches
     ORDER BY preferred_vendor DESC, rating DESC NULLS LAST, lower(company_name)`,
    [rfqId]
  );
  return rows as VendorLite[];
}

/**
 * Every active vendor in the RFQ's org, regardless of trade — backs the
 * "Show all vendors" toggle in the issue/invite dialog when the trade-matched
 * suggestion list is too narrow. Same VendorLite shape, org-scoping and
 * ordering as getSuggestedVendorsForRfq, minus the category filter.
 */
export async function getAllVendorsForRfq(
  rfqId: string
): Promise<VendorLite[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       v.id, v.company_name, v.vendor_code, v.status,
       v.rating::float8 AS rating, v.preferred_vendor,
       (SELECT email FROM vendor_contact
        WHERE vendor_id = v.id AND is_primary = true LIMIT 1) AS primary_contact_email
     FROM vendor v
     WHERE v.status = 'active'
       AND v.org_id = (SELECT org_id FROM rfq WHERE id = $1)
     ORDER BY v.preferred_vendor DESC, v.rating DESC NULLS LAST, lower(v.company_name)`,
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
    "r.status NOT IN ('draft','cancelled','superseded')",
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
       r.id, r.rfq_number, r.title, r.status, r.revision_number,
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
      // Vendor-portal list doesn't surface quote newness — not needed.
      latest_quote_submitted_at: null,
      revision_number: r.revision_number,
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
       AND r.status NOT IN ('draft','cancelled','superseded')`,
    [rfqId, vendorId]
  );
  const rfq = rfqRows[0];
  if (!rfq) return null;

  // Items + events in parallel — independent post-header.
  const [itemRes, studioEvents] = await Promise.all([
    pool.query<RfqItem>(
      // `proposed_price` is the internal (client-facing) price — never exposed
      // to vendors; nulled here. `attachments` (spec files) they DO need.
      `SELECT id, rfq_id, boq_item_id, description, unit, quantity, spec_notes,
              sort_order, NULL AS proposed_price, attachments,
              awarded_vendor_id, awarded_quote_item_id
       FROM rfq_item
       WHERE rfq_id = $1
       ORDER BY sort_order, description`,
      [rfqId]
    ),
    getRfqEvents(rfqId),
  ]);
  const itemRows = itemRes.rows;

  // Vendors get a sanitised event list:
  //  - studio user identities stripped (actorId / actorName)
  //  - other vendors' identities stripped from RFQ events (vendor_names /
  //    vendor_ids on rfq.issued / rfq.vendors_added)
  //  - quote.* events filtered to ONLY this vendor's own submissions, so
  //    they don't see competitors' submission activity at all
  const events: RfqEvent[] = studioEvents
    .filter((e) => {
      // Studio-internal notes (e.g. logged communications) never go to vendors.
      if (STUDIO_ONLY_ACTIONS.has(e.action)) return false;
      if (
        e.action === "quote.submitted" ||
        e.action === "quote.revised" ||
        e.action === "quote.declined" ||
        e.action === "quote.awarded" ||
        e.action === "quote.rejected" ||
        e.action === "quote.under_review"
      ) {
        // Own-quote events only — never surface a competitor's submission or
        // decline (identity + reason) to other invited vendors.
        const meta = e.metadata as Record<string, unknown> | null;
        return meta?.vendor_id === vendorId;
      }
      return true;
    })
    .map((e) => {
      const metadata = e.metadata
        ? Object.fromEntries(
            Object.entries(e.metadata).filter(
              ([key]) =>
                key !== "vendor_names" &&
                key !== "vendor_ids" &&
                key !== "winning_vendor_names"
            )
          )
        : null;
      return { ...e, actorId: null, actorName: null, metadata };
    });

  return {
    ...rfq,
    items: itemRows.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    events,
    // Revision chain is studio-internal; the vendor portal doesn't surface it.
    supersedes: null,
    superseded_by: null,
  };
}

/**
 * `receives_rfq = true` contacts for every vendor on this RFQ's invitation
 * list. Drives the email fan-out fired by the `issue` route after the
 * mutation commits.
 */
export interface RfqContactForEmail {
  vendorId: string;
  vendorName: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactUserId: string | null;
}

/**
 * `receives_rfq = true` contacts for vendors on this RFQ's invitation list,
 * joined with `vendor.company_name` and the `vendor_contact.user_id` link
 * (when a vendor user has accepted the portal invite). Pass `vendorIds`
 * to scope to a subset — used by the invite-more flow so emails only fire
 * to newly-added vendors.
 */
export async function getRfqContactsForEmail(
  rfqId: string,
  vendorIds?: readonly string[]
): Promise<RfqContactForEmail[]> {
  if (vendorIds && vendorIds.length === 0) return [];
  const pool = getPool();
  const params: unknown[] = [rfqId];
  let vendorFilter = "";
  if (vendorIds) {
    params.push(Array.from(new Set(vendorIds)));
    vendorFilter = `AND rv.vendor_id = ANY($${params.length}::uuid[])`;
  }
  const { rows } = await pool.query(
    `SELECT
       v.id AS vendor_id,
       v.company_name AS vendor_name,
       vc.id AS contact_id,
       vc.name AS contact_name,
       vc.email AS contact_email,
       vc.user_id AS contact_user_id
     FROM rfq_vendor rv
     JOIN vendor v ON v.id = rv.vendor_id
     JOIN vendor_contact vc ON vc.vendor_id = v.id
     WHERE rv.rfq_id = $1
       ${vendorFilter}
       AND vc.receives_rfq = true
       AND vc.email IS NOT NULL
       AND v.status = 'active'
     ORDER BY lower(v.company_name), vc.is_primary DESC, lower(vc.name)`,
    params
  );
  return rows.map((r) => ({
    vendorId: r.vendor_id,
    vendorName: r.vendor_name,
    contactId: r.contact_id,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactUserId: r.contact_user_id,
  }));
}

// ── Mutations ───────────────────────────────────────────────────────────────

export interface NewRfqItem {
  boqItemId: string;
  description: string;
  unit: string;
  quantity: number;
  specNotes?: string | null;
}

export interface CreateRfqInput {
  title: string;
  packageType?: string | null;
  scopeOfWork?: string | null;
  termsConditions?: string | null;
  responseDeadline?: string | null;
  items: NewRfqItem[];
}

/**
 * Bulk-insert `rfq_item` rows via parallel `unnest` arrays — single
 * round-trip regardless of item count. `startSortOrder` lets a caller
 * append to an existing item list without colliding sort values.
 */
async function bulkInsertRfqItems(
  client: import("pg").PoolClient,
  rfqId: string,
  items: readonly NewRfqItem[],
  startSortOrder: number
): Promise<void> {
  if (items.length === 0) return;
  await client.query(
    // proposed_price is the per-UNIT proposed rate (sell line total ÷ qty) so it
    // lines up with the vendor unit prices in the comparison sheet (§11).
    // category_id is snapshotted straight from the source BOQ item (bi) so the
    // RFQ carries the service area at issue time even if the BOQ item is later
    // reclassified — mirroring how description/unit/quantity are snapshotted.
    `INSERT INTO rfq_item (rfq_id, boq_item_id, description, unit, quantity, spec_notes, sort_order, proposed_price, category_id)
     SELECT $1::uuid, t.boq_item_id, t.description, t.unit, t.quantity, t.spec_notes, t.sort_order,
            (${BOQ_SELL_PRICE_SQL}) / NULLIF(bi.quantity, 0),
            bi.category_id
     FROM UNNEST(
       $2::uuid[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::int[]
     ) AS t(boq_item_id, description, unit, quantity, spec_notes, sort_order)
     LEFT JOIN boq_item bi ON bi.id = t.boq_item_id`,
    [
      rfqId,
      items.map((i) => i.boqItemId),
      items.map((i) => i.description),
      items.map((i) => i.unit),
      items.map((i) => String(i.quantity)),
      items.map((i) => i.specNotes ?? null),
      items.map((_, idx) => startSortOrder + idx),
    ]
  );
}

/**
 * Bulk-insert `rfq_vendor` rows via parallel `unnest` arrays, with
 * ON CONFLICT skipping duplicates. RETURNING surfaces only the rows that
 * actually inserted — used by the invite-more flow to know which vendors
 * are new so emails only fire to those.
 */
async function bulkInsertRfqVendors(
  client: import("pg").PoolClient,
  rfqId: string,
  vendorIds: readonly string[],
  invitedBy: string
): Promise<string[]> {
  if (vendorIds.length === 0) return [];
  // Stamp the §11 distribution method per vendor (`email` if the issue fan-out
  // will reach a receives_rfq contact, else `portal`) + snapshot the contact
  // name the RFQ was sent to (the primary receiving contact).
  const { rows } = await client.query<{ vendor_id: string }>(
    `INSERT INTO rfq_vendor (rfq_id, vendor_id, invited_by, distribution_method, contact_name)
     SELECT $1::uuid, t.vendor_id, $3,
            CASE WHEN EXISTS (
              SELECT 1 FROM vendor_contact vc
              WHERE vc.vendor_id = t.vendor_id AND vc.receives_rfq = true
            ) THEN 'email' ELSE 'portal' END,
            (SELECT vc.name FROM vendor_contact vc
             WHERE vc.vendor_id = t.vendor_id AND vc.receives_rfq = true
             ORDER BY vc.is_primary DESC NULLS LAST LIMIT 1)
     FROM UNNEST($2::uuid[]) AS t(vendor_id)
     ON CONFLICT (rfq_id, vendor_id) DO NOTHING
     RETURNING vendor_id`,
    [rfqId, vendorIds, invitedBy]
  );
  return rows.map((r) => r.vendor_id);
}

/**
 * §11: when a per-vendor communication (§17) is logged through a channel other
 * than how the RFQ was originally distributed, the vendor has been reached via
 * more than one channel — flip their `distribution_method` to `mixed`. No-op
 * when the channel matches the current method, it's already `mixed`, or the
 * vendor has no stamped method (a pre-tracking invite).
 */
export async function markVendorDistributionMixed(
  rfqId: string,
  vendorId: string,
  channel: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE rfq_vendor
        SET distribution_method = 'mixed'
      WHERE rfq_id = $1 AND vendor_id = $2
        AND distribution_method IS NOT NULL
        AND distribution_method NOT IN ('mixed', $3)`,
    [rfqId, vendorId, channel]
  );
}

/**
 * Create an RFQ draft in a single transaction. Generates `rfq_number` via
 * the shared sequence counter (`RFQ-{YEAR}-{SEQ}`) and inserts items with
 * sort_order matching input order. Reads `org_id` from the project so the
 * caller doesn't have to thread it through.
 *
 * All boqItemIds must belong to a BOQ that belongs to the same project —
 * `verifyBoqItemsInProject` is run inside the transaction so a concurrent
 * BOQ-item move can't sneak between check and insert.
 */
export async function createRfqDraft(
  projectId: string,
  userId: string,
  input: CreateRfqInput
): Promise<Rfq> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: projectRows } = await client.query<{
      org_id: string;
      project_number: string | null;
    }>(`SELECT org_id, project_number FROM project WHERE id = $1`, [projectId]);
    const orgId = projectRows[0]?.org_id;
    if (!orgId) {
      await client.query("ROLLBACK");
      throw new Error("Project not found");
    }
    const projectNumber = projectRows[0]?.project_number;
    if (!projectNumber) {
      await client.query("ROLLBACK");
      throw new Error(`Project ${projectId} has no project_number`);
    }

    // Verify every BOQ item belongs to this project's BOQ. Run inside tx
    // so a concurrent BOQ delete/move can't bypass the check.
    const boqItemIds = input.items.map((i) => i.boqItemId);
    const { rows: ownCheck } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM boq_item bi
       JOIN boq b ON b.id = bi.boq_id
       WHERE bi.id = ANY($1::uuid[]) AND b.project_id = $2`,
      [boqItemIds, projectId]
    );
    if (Number(ownCheck[0]?.count ?? 0) !== boqItemIds.length) {
      await client.query("ROLLBACK");
      throw new Error("One or more BOQ items do not belong to this project");
    }
    // RFQ-4a eligibility gate: every item must be marked Ready for Procurement
    // (the PM's approval-for-RFQ) and not already committed to another RFQ.
    const { rows: eligible } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM boq_item
        WHERE id = ANY($1::uuid[])
          AND phase = ANY($2::text[])
          AND po_status = 'none'`,
      [boqItemIds, [...RFQ_ELIGIBLE_PHASES]]
    );
    if (Number(eligible[0]?.count ?? 0) !== boqItemIds.length) {
      await client.query("ROLLBACK");
      throw new Error(
        "One or more BOQ items are not ready for procurement (or already in an RFQ)"
      );
    }

    // The RFQ number is rooted in the project (P2026-001-RFQ-001). Use the
    // tx-bound sequence helper so a later ROLLBACK reverses the advance —
    // otherwise a failed RFQ create burns a number and leaves a visible gap.
    const rfqNumber = await nextDocumentNumber(
      client,
      orgId,
      projectNumber,
      DOC_TYPES.RFQ
    );

    const { rows: rfqRows } = await client.query<Rfq>(
      `INSERT INTO rfq (
         org_id, project_id, rfq_number, title, status, package_type,
         scope_of_work, terms_conditions, response_deadline, created_by
       ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId,
        projectId,
        rfqNumber,
        input.title,
        input.packageType ?? null,
        input.scopeOfWork ?? null,
        input.termsConditions ?? null,
        input.responseDeadline ?? null,
        userId,
      ]
    );
    const rfq = rfqRows[0];

    await bulkInsertRfqItems(client, rfq.id, input.items, 0);

    await client.query("COMMIT");
    return rfq;
  } catch (err) {
    await client.query("ROLLBACK");
    const pgErr = err as Parameters<typeof mapPgError>[0] & {
      message?: string;
    };
    if (pgErr.code) {
      throw new Error(mapPgError(pgErr));
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface UpdateRfqInput {
  title?: string;
  packageType?: string | null;
  scopeOfWork?: string | null;
  termsConditions?: string | null;
  responseDeadline?: string | null;
}

/**
 * Append BOQ items to an existing draft RFQ. Refused once the RFQ is no
 * longer in draft — changing scope after vendors have started bidding is
 * a procurement-process change, not a UI tweak; the right move there is
 * to create a new RFQ.
 *
 * Verifies every BOQ item belongs to the RFQ's project inside the
 * transaction so a concurrent BOQ delete/move can't bypass the check.
 * Sort_order continues from where the existing items left off, so a
 * mixed UI list renders in insertion order without gaps.
 */
export async function addRfqItems(
  rfqId: string,
  items: NewRfqItem[]
): Promise<
  | { ok: true; count: number }
  | {
      ok: false;
      reason: "not_found" | "wrong_status" | "no_items" | "bad_items";
    }
> {
  if (items.length === 0) return { ok: false, reason: "no_items" };
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rfqRows } = await client.query<{
      status: string;
      project_id: string;
      next_sort: number;
    }>(
      `SELECT r.status, r.project_id,
              COALESCE(MAX(ri.sort_order), -1) + 1 AS next_sort
         FROM rfq r
         LEFT JOIN rfq_item ri ON ri.rfq_id = r.id
        WHERE r.id = $1
        GROUP BY r.status, r.project_id
        FOR UPDATE`,
      [rfqId]
    );
    const rfq = rfqRows[0];
    if (!rfq) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (rfq.status !== "draft") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const boqItemIds = items.map((i) => i.boqItemId);
    const { rows: ownCheck } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM boq_item bi
       JOIN boq b ON b.id = bi.boq_id
       WHERE bi.id = ANY($1::uuid[]) AND b.project_id = $2`,
      [boqItemIds, rfq.project_id]
    );
    if (Number(ownCheck[0]?.count ?? 0) !== boqItemIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "bad_items" };
    }
    // RFQ-4a eligibility gate: Ready for Procurement + not already in an RFQ.
    const { rows: eligible } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM boq_item
        WHERE id = ANY($1::uuid[])
          AND phase = ANY($2::text[])
          AND po_status = 'none'`,
      [boqItemIds, [...RFQ_ELIGIBLE_PHASES]]
    );
    if (Number(eligible[0]?.count ?? 0) !== boqItemIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "bad_items" };
    }

    await bulkInsertRfqItems(client, rfqId, items, rfq.next_sort);

    await client.query(`UPDATE rfq SET updated_at = now() WHERE id = $1`, [
      rfqId,
    ]);

    await client.query("COMMIT");
    return { ok: true, count: items.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete one item from a draft RFQ. Same status guard as `addRfqItems`.
 * Returns `wrong_status` once the RFQ is issued or further along — at
 * that point a vendor may already be quoting on the item and removing
 * it silently breaks the bid contract.
 */
export async function removeRfqItem(
  rfqId: string,
  itemId: string
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "wrong_status" }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rfqRows } = await client.query<{ status: string }>(
      `SELECT status FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    const rfq = rfqRows[0];
    if (!rfq) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (rfq.status !== "draft") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const { rowCount } = await client.query(
      `DELETE FROM rfq_item WHERE id = $1 AND rfq_id = $2`,
      [itemId, rfqId]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }

    await client.query(`UPDATE rfq SET updated_at = now() WHERE id = $1`, [
      rfqId,
    ]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * PRD §11: replace an RFQ line's reference attachments ({url, fileName}[]).
 * Allowed while the RFQ is live (not terminal) — attaching a clarifying spec
 * after issue is legitimate. Verifies the item belongs to the RFQ.
 */
export async function updateRfqItemAttachments(
  rfqId: string,
  rfqItemId: string,
  attachments: { url: string; fileName: string }[]
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "wrong_status" }> {
  const pool = getPool();
  const { rows } = await pool.query<{ status: string }>(
    `SELECT r.status
       FROM rfq_item ri JOIN rfq r ON r.id = ri.rfq_id
      WHERE ri.id = $1 AND ri.rfq_id = $2`,
    [rfqItemId, rfqId]
  );
  if (rows.length === 0) return { ok: false, reason: "not_found" };
  if ((RFQ_TERMINAL_STATUSES as readonly string[]).includes(rows[0].status)) {
    return { ok: false, reason: "wrong_status" };
  }
  await pool.query(
    `UPDATE rfq_item SET attachments = $3::jsonb WHERE id = $1 AND rfq_id = $2`,
    [rfqItemId, rfqId, JSON.stringify(attachments)]
  );
  return { ok: true };
}

const RFQ_HEADER_COLS: Record<keyof UpdateRfqInput, string> = {
  title: "title",
  packageType: "package_type",
  scopeOfWork: "scope_of_work",
  termsConditions: "terms_conditions",
  responseDeadline: "response_deadline",
};

/**
 * Patch an RFQ's header fields. Allowed on every status that's still
 * "live" (draft / issued / quotes_received / under_review). Refuses on
 * `awarded` and `cancelled` — once the RFQ is locked into an award flow
 * or terminated, the header is part of the audit record and shouldn't
 * change.
 *
 * Post-issue edits are intentional and surfaced via the audit log
 * (`rfq.updated`). The UI shows a warning in that case so PMs know
 * vendors will see the change on their next visit (no automatic
 * notification fires — that's a deliberate hands-off choice, since
 * most edits are typo fixes / deadline extensions, not scope changes).
 *
 * Returns `{ok: false, reason: "not_found"}` for missing RFQs,
 * `{ok: false, reason: "wrong_status"}` for awarded/cancelled, and
 * `{ok: false, reason: "no_changes"}` when no fields are set.
 */
export async function updateRfqDraft(
  rfqId: string,
  patch: UpdateRfqInput
): Promise<
  | { ok: true; row: Rfq }
  | { ok: false; reason: "not_found" | "wrong_status" | "no_changes" }
> {
  const cols: string[] = [];
  const params: unknown[] = [];
  for (const [key, dbCol] of Object.entries(RFQ_HEADER_COLS) as [
    keyof UpdateRfqInput,
    string,
  ][]) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      cols.push(`${dbCol} = $${params.length}`);
    }
  }
  if (cols.length === 0) return { ok: false, reason: "no_changes" };

  params.push(rfqId);
  const idIdx = params.length;
  const pool = getPool();
  const { rows } = await pool.query<Rfq>(
    `UPDATE rfq
        SET ${cols.join(", ")}, updated_at = now()
      WHERE id = $${idIdx}
        AND status NOT IN ('awarded','cancelled','superseded')
      RETURNING *`,
    params
  );
  if (rows.length === 0) {
    // Either missing or in a terminal status. Probe to distinguish so the
    // route can return the right HTTP code.
    const { rows: probe } = await pool.query<{ status: string }>(
      `SELECT status FROM rfq WHERE id = $1`,
      [rfqId]
    );
    if (probe.length === 0) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "wrong_status" };
  }
  return { ok: true, row: rows[0] };
}

/**
 * Issue a draft RFQ to one or more vendors. Transaction:
 *
 *  1. Lock the rfq row, assert status='draft' and ≥1 item.
 *  2. Assert all vendorIds belong to the RFQ's org and are active.
 *  3. Flip status='issued', set issued_date=today.
 *  4. Upsert rfq_vendor rows (ON CONFLICT DO NOTHING handles re-runs).
 *  5. Flip boq_item.po_status='rfq_issued' for every item on the RFQ.
 *
 * Email fan-out is fired by the route AFTER commit using
 * `getRfqContactsForEmail(rfqId)` — keeping email out of the tx so SMTP
 * latency / failures don't poison the DB transaction.
 */
export async function issueRfq(
  rfqId: string,
  vendorIds: readonly string[],
  actorId: string
): Promise<
  | { ok: true; rfq: Rfq }
  | {
      ok: false;
      reason: "not_found" | "wrong_status" | "no_items" | "bad_vendors";
    }
> {
  if (vendorIds.length === 0) {
    return { ok: false, reason: "bad_vendors" };
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rfqRows } = await client.query<Rfq>(
      `SELECT * FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    const rfq = rfqRows[0];
    if (!rfq) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (rfq.status !== "draft") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const { rows: itemRows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rfq_item WHERE rfq_id = $1`,
      [rfqId]
    );
    if (Number(itemRows[0]?.count ?? 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "no_items" };
    }

    // Validate every vendor belongs to the rfq's org + is active.
    const uniqueVendorIds = Array.from(new Set(vendorIds));
    const { rows: vendorCheck } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM vendor
       WHERE id = ANY($1::uuid[]) AND org_id = $2 AND status = 'active'`,
      [uniqueVendorIds, rfq.org_id]
    );
    if (Number(vendorCheck[0]?.count ?? 0) !== uniqueVendorIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "bad_vendors" };
    }

    const { rows: updatedRfq } = await client.query<Rfq>(
      `UPDATE rfq
          SET status = 'issued',
              issued_date = CURRENT_DATE,
              updated_at = now()
        WHERE id = $1
       RETURNING *`,
      [rfqId]
    );

    // Bulk-insert invitations. ON CONFLICT keeps idempotency if an issue
    // route retry slipped through — we never overwrite an existing invite.
    await bulkInsertRfqVendors(client, rfqId, uniqueVendorIds, actorId);

    // A revision draft carries copied invites; reconcile so the final set is
    // exactly what the PM selected. Scoped to revisions so a normal issue's
    // vendor set is only ever added to, never pruned.
    if (rfq.supersedes_rfq_id) {
      await client.query(
        `DELETE FROM rfq_vendor WHERE rfq_id = $1 AND vendor_id <> ALL($2::uuid[])`,
        [rfqId, uniqueVendorIds]
      );
    }

    // Flip BOQ po_status for the referenced items. WHERE filter intentionally
    // restricted to po_status='none' so we don't downgrade an item already on
    // a more advanced track (`quoted`, `po_raised`, `delivered`).
    await client.query(
      `UPDATE boq_item bi
          SET po_status = 'rfq_issued',
              updated_at = now()
         FROM rfq_item ri
        WHERE ri.rfq_id = $1
          AND ri.boq_item_id = bi.id
          AND bi.po_status = 'none'`,
      [rfqId]
    );

    await client.query("COMMIT");
    return { ok: true, rfq: updatedRfq[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Add more vendors to an already-issued RFQ. Refuses on draft (use
 * `issueRfq` instead), cancelled, or awarded. Returns the IDs that were
 * actually inserted (ON CONFLICT skips duplicates), so the caller can
 * scope the email fan-out to only the NEW invitees.
 */
export async function inviteRfqVendors(
  rfqId: string,
  vendorIds: readonly string[],
  actorId: string
): Promise<
  | { ok: true; rfq: Rfq; addedVendorIds: string[] }
  | {
      ok: false;
      reason: "not_found" | "wrong_status" | "bad_vendors" | "no_vendors";
    }
> {
  if (vendorIds.length === 0) {
    return { ok: false, reason: "no_vendors" };
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rfqRows } = await client.query<Rfq>(
      `SELECT * FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    const rfq = rfqRows[0];
    if (!rfq) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    // Additive flow — only valid AFTER issue and BEFORE award/cancel.
    if (!(RFQ_INVITEABLE_STATUSES as readonly string[]).includes(rfq.status)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const uniqueIds = Array.from(new Set(vendorIds));
    const { rows: vendorCheck } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM vendor
       WHERE id = ANY($1::uuid[]) AND org_id = $2 AND status = 'active'`,
      [uniqueIds, rfq.org_id]
    );
    if (Number(vendorCheck[0]?.count ?? 0) !== uniqueIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "bad_vendors" };
    }

    // ON CONFLICT skips duplicates and RETURNING gives only the newly
    // inserted rows, so the caller's email fan-out only hits new invitees.
    const addedVendorIds = await bulkInsertRfqVendors(
      client,
      rfqId,
      uniqueIds,
      actorId
    );

    await client.query(`UPDATE rfq SET updated_at = now() WHERE id = $1`, [
      rfqId,
    ]);

    await client.query("COMMIT");
    return { ok: true, rfq, addedVendorIds };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel an RFQ. Flips status='cancelled' and reverts each BOQ item's
 * `po_status` to `'none'` ONLY when no OTHER live RFQ still references it
 * (the "live" subquery filters out `cancelled` RFQs and the row being
 * cancelled itself). Refuses once an award has been recorded —
 * `awarded` RFQs need to go through a dedicated rescind flow (F11).
 */
export async function cancelRfq(
  rfqId: string
): Promise<
  { ok: true; rfq: Rfq } | { ok: false; reason: "not_found" | "wrong_status" }
> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rfqRows } = await client.query<Rfq>(
      `SELECT * FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    const rfq = rfqRows[0];
    if (!rfq) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    // Terminal RFQs (awarded / cancelled / superseded) can't be cancelled.
    if ((RFQ_TERMINAL_STATUSES as readonly string[]).includes(rfq.status)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const { rows: updatedRfq } = await client.query<Rfq>(
      `UPDATE rfq SET status='cancelled', updated_at=now() WHERE id=$1 RETURNING *`,
      [rfqId]
    );

    // Revert BOQ items only when no other LIVE rfq still references them.
    // "Live" = status NOT IN ('cancelled') and not this rfq.
    await client.query(
      `UPDATE boq_item bi
          SET po_status = 'none',
              updated_at = now()
         FROM rfq_item ri
        WHERE ri.rfq_id = $1
          AND ri.boq_item_id = bi.id
          AND bi.po_status = 'rfq_issued'
          AND NOT EXISTS (
            SELECT 1 FROM rfq_item ri2
            JOIN rfq r2 ON r2.id = ri2.rfq_id
            WHERE ri2.boq_item_id = bi.id
              AND r2.id <> $1
              AND r2.status NOT IN ('cancelled', 'superseded')
          )`,
      [rfqId]
    );

    await client.query("COMMIT");
    return { ok: true, rfq: updatedRfq[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Raise a REVISION of an issued/awarded RFQ (RFQ-3b). Clones the RFQ into a new
 * `draft` row that reuses the base `rfq_number` (`revision_number + 1`), copies
 * its items (award links reset) and its invited vendors (a default the PM can
 * adjust at issue), then moves the old RFQ to `superseded`. `boq_item.po_status`
 * is intentionally left untouched — the revision carries the same items forward.
 * Mirrors `cancelRfq`'s FOR-UPDATE + status-guard pattern.
 */
export async function cloneRfqAsRevision(
  rfqId: string,
  userId: string,
  reason?: string | null
): Promise<
  { ok: true; rfq: Rfq } | { ok: false; reason: "not_found" | "wrong_status" }
> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<Rfq>(
      `SELECT * FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    const old = rows[0];
    if (!old) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (!(RFQ_REVISABLE_STATUSES as readonly string[]).includes(old.status)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const { rows: newRows } = await client.query<Rfq>(
      `INSERT INTO rfq (
         org_id, project_id, rfq_number, title, status,
         scope_of_work, terms_conditions, response_deadline, created_by,
         revision_number, supersedes_rfq_id, revision_reason
       ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        old.org_id,
        old.project_id,
        old.rfq_number,
        old.title,
        old.scope_of_work,
        old.terms_conditions,
        old.response_deadline,
        userId,
        old.revision_number + 1,
        old.id,
        reason ?? null,
      ]
    );
    const next = newRows[0];

    // Items: description/unit/quantity are sourced from the LIVE boq_item so the
    // revision reflects the current BOQ (RFQ-3c) — the whole point of revising
    // after a scope change. spec_notes + sort_order + attachments stay
    // RFQ-specific and carry over. Award links reset by omission (default null
    // on the fresh rows). Items removed from scope (excluded) are dropped
    // (RFQ-3d). proposed_price re-snapshots the per-unit rate from the live BOQ.
    await client.query(
      `INSERT INTO rfq_item (rfq_id, boq_item_id, description, unit, quantity, spec_notes, sort_order, attachments, proposed_price, category_id)
       SELECT $1, ri.boq_item_id, bi.description, bi.unit, bi.quantity,
              ri.spec_notes, ri.sort_order, ri.attachments,
              (${BOQ_SELL_PRICE_SQL}) / NULLIF(bi.quantity, 0),
              bi.category_id
       FROM rfq_item ri
       JOIN boq_item bi ON bi.id = ri.boq_item_id
       WHERE ri.rfq_id = $2 AND NOT bi.is_excluded`,
      [next.id, old.id]
    );

    // Invited vendors copied as a default; re-stamped to the reviser/now, with
    // the §11 distribution method re-derived (a revision is re-issued fresh).
    await client.query(
      `INSERT INTO rfq_vendor (rfq_id, vendor_id, invited_by, distribution_method, contact_name)
       SELECT $1, rv.vendor_id, $2,
              CASE WHEN EXISTS (
                SELECT 1 FROM vendor_contact vc
                WHERE vc.vendor_id = rv.vendor_id AND vc.receives_rfq = true
              ) THEN 'email' ELSE 'portal' END,
              (SELECT vc.name FROM vendor_contact vc
               WHERE vc.vendor_id = rv.vendor_id AND vc.receives_rfq = true
               ORDER BY vc.is_primary DESC NULLS LAST LIMIT 1)
       FROM rfq_vendor rv WHERE rv.rfq_id = $3`,
      [next.id, userId, old.id]
    );

    await client.query(
      `UPDATE rfq SET status = 'superseded', updated_at = now() WHERE id = $1`,
      [old.id]
    );

    await client.query("COMMIT");
    return { ok: true, rfq: next };
  } catch (err) {
    // No user-supplied data reaches a constraint here (numbers/ids are copied
    // from the locked source row), so there's nothing to map — just rethrow.
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Pull current BOQ quantities into a live RFQ's items (RFQ-3c "Sync from BOQ").
 * Quantity ONLY — per PRD §22 a specification change requires a re-quote (that
 * routes to a revision), so it is deliberately NOT synced in place here.
 * Refused unless the RFQ is in-flight (issued / quotes_received / under_review).
 */
export async function syncRfqItemsFromBoq(
  rfqId: string
): Promise<
  | { ok: true; synced: number }
  | { ok: false; reason: "not_found" | "wrong_status" }
> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (
      !(QUOTE_SUBMITTABLE_RFQ_STATUSES as readonly string[]).includes(
        rows[0].status
      )
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_status" };
    }

    const res = await client.query(
      `UPDATE rfq_item ri
          SET quantity = bi.quantity
         FROM boq_item bi
        WHERE bi.id = ri.boq_item_id
          AND ri.rfq_id = $1
          AND ri.quantity <> bi.quantity`,
      [rfqId]
    );

    await client.query("COMMIT");
    return { ok: true, synced: res.rowCount ?? 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
