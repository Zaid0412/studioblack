import { getPool } from "@/lib/db";
import type {
  Rfq,
  RfqEvent,
  RfqItem,
  RfqVendorInvite,
  RfqListRow,
  RfqStatus,
  RfqWithItems,
  VendorLite,
} from "@/types";
import { escapeSqlLike } from "./helpers";
import { getNextSequenceNumber } from "./boq";
import { mapPgError } from "./_pgErrors";

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

  const events = await getRfqEvents(rfqId);

  return {
    ...rfq,
    items: itemRows.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    vendors: vendorRows,
    events,
  };
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
async function getRfqEvents(rfqId: string): Promise<RfqEvent[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ae.id, ae.action, ae.created_at, ae.actor_id, u.name AS actor_name,
            ae.metadata
     FROM audit_event ae
     LEFT JOIN "user" u ON u.id = ae.actor_id
     WHERE ae.target_table = 'rfq'
       AND ae.target_id = $1::uuid
       AND ae.action IN ('rfq.created','rfq.issued','rfq.vendors_added','rfq.cancelled')
     ORDER BY ae.created_at ASC`,
    [rfqId]
  );

  // Collect vendor IDs across all events with vendor metadata that are
  // missing names so we can resolve them with a single batched lookup.
  const VENDOR_BEARING_ACTIONS = new Set(["rfq.issued", "rfq.vendors_added"]);
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

  return rows.map((r) => {
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
     ),
     -- DISTINCT inside a CTE so the outer ORDER BY can reference
     -- expressions (lower(company_name)) without Postgres rejecting it
     -- with "ORDER BY expressions must appear in select list".
     matches AS (
       SELECT DISTINCT
         v.id, v.company_name, v.vendor_code, v.status, v.rating,
         (SELECT email FROM vendor_contact
          WHERE vendor_id = v.id AND is_primary = true LIMIT 1) AS primary_contact_email
       FROM vendor v
       JOIN vendor_trade vt ON vt.vendor_id = v.id
       WHERE vt.category_id IN (SELECT id FROM cat_ancestors)
         AND v.status = 'active'
         AND v.org_id = (SELECT org_id FROM rfq WHERE id = $1)
     )
     SELECT * FROM matches
     ORDER BY rating DESC NULLS LAST, lower(company_name)`,
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

  // Vendors get a sanitised event list: actor names AND vendor names
  // stripped (competitive info — they shouldn't see other vendors'
  // identities on issued events, nor which studio user did what).
  const studioEvents = await getRfqEvents(rfqId);
  const events: RfqEvent[] = studioEvents.map((e) => {
    const metadata = e.metadata
      ? Object.fromEntries(
          Object.entries(e.metadata).filter(
            ([key]) => key !== "vendor_names" && key !== "vendor_ids"
          )
        )
      : null;
    return { ...e, actorId: null, actorName: null, metadata };
  });

  return {
    ...rfq,
    items: itemRows.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    events,
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
 * `receives_rfq = true` contacts for every vendor on this RFQ's invitation
 * list, joined with `vendor.company_name` and the `vendor_contact.user_id`
 * link (when a vendor user has accepted the portal invite).
 */
export async function getRfqContactsForEmail(
  rfqId: string
): Promise<RfqContactForEmail[]> {
  const pool = getPool();
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
       AND vc.receives_rfq = true
       AND vc.email IS NOT NULL
       AND v.status = 'active'
     ORDER BY lower(v.company_name), vc.is_primary DESC, lower(vc.name)`,
    [rfqId]
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
  scopeOfWork?: string | null;
  termsConditions?: string | null;
  responseDeadline?: string | null;
  items: NewRfqItem[];
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

    const { rows: projectRows } = await client.query<{ org_id: string }>(
      `SELECT org_id FROM project WHERE id = $1`,
      [projectId]
    );
    const orgId = projectRows[0]?.org_id;
    if (!orgId) {
      await client.query("ROLLBACK");
      throw new Error("Project not found");
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

    const rfqNumber = await getNextSequenceNumber(orgId, "RFQ");

    const { rows: rfqRows } = await client.query<Rfq>(
      `INSERT INTO rfq (
         org_id, project_id, rfq_number, title, status,
         scope_of_work, terms_conditions, response_deadline, created_by
       ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8)
       RETURNING *`,
      [
        orgId,
        projectId,
        rfqNumber,
        input.title,
        input.scopeOfWork ?? null,
        input.termsConditions ?? null,
        input.responseDeadline ?? null,
        userId,
      ]
    );
    const rfq = rfqRows[0];

    // Bulk-insert items. Index drives sort_order so the create flow's order
    // is preserved.
    for (const [idx, item] of input.items.entries()) {
      await client.query(
        `INSERT INTO rfq_item (
           rfq_id, boq_item_id, description, unit, quantity,
           spec_notes, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          rfq.id,
          item.boqItemId,
          item.description,
          item.unit,
          item.quantity,
          item.specNotes ?? null,
          idx,
        ]
      );
    }

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

    for (const [idx, item] of items.entries()) {
      await client.query(
        `INSERT INTO rfq_item (
           rfq_id, boq_item_id, description, unit, quantity,
           spec_notes, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          rfqId,
          item.boqItemId,
          item.description,
          item.unit,
          item.quantity,
          item.specNotes ?? null,
          rfq.next_sort + idx,
        ]
      );
    }

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

const RFQ_HEADER_COLS: Record<keyof UpdateRfqInput, string> = {
  title: "title",
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
        AND status NOT IN ('awarded','cancelled')
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
    for (const vendorId of uniqueVendorIds) {
      await client.query(
        `INSERT INTO rfq_vendor (rfq_id, vendor_id, invited_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (rfq_id, vendor_id) DO NOTHING`,
        [rfqId, vendorId, actorId]
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
    if (!["issued", "quotes_received", "under_review"].includes(rfq.status)) {
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

    // RETURNING surfaces only the rows the INSERT actually created — vendors
    // who were already on rfq_vendor (ON CONFLICT) are skipped here, so the
    // caller's email fan-out only hits NEW invitees.
    const addedVendorIds: string[] = [];
    for (const vendorId of uniqueIds) {
      const { rows: inserted } = await client.query<{ vendor_id: string }>(
        `INSERT INTO rfq_vendor (rfq_id, vendor_id, invited_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (rfq_id, vendor_id) DO NOTHING
         RETURNING vendor_id`,
        [rfqId, vendorId, actorId]
      );
      if (inserted.length > 0) addedVendorIds.push(inserted[0].vendor_id);
    }

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
 * Email-fan-out helper scoped to a specific subset of vendors. Used by the
 * "invite more vendors" flow so the email loop hits ONLY the new invitees,
 * not the ones who were already on the RFQ.
 */
export async function getRfqContactsForEmailByVendors(
  rfqId: string,
  vendorIds: readonly string[]
): Promise<
  Array<{
    vendorId: string;
    vendorName: string;
    contactId: string;
    contactName: string;
    contactEmail: string;
    contactUserId: string | null;
  }>
> {
  if (vendorIds.length === 0) return [];
  const pool = getPool();
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
       AND rv.vendor_id = ANY($2::uuid[])
       AND vc.receives_rfq = true
       AND vc.email IS NOT NULL
       AND v.status = 'active'
     ORDER BY lower(v.company_name), vc.is_primary DESC, lower(vc.name)`,
    [rfqId, Array.from(new Set(vendorIds))]
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
    if (rfq.status === "cancelled" || rfq.status === "awarded") {
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
              AND r2.status NOT IN ('cancelled')
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
