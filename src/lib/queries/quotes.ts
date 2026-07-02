import { getPool } from "@/lib/db";
import type {
  QuoteAttachment,
  QuoteComparison,
  QuoteComparisonRow,
  QuoteComparisonVendorColumn,
  Rfq,
  VendorQuote,
  VendorQuoteItem,
  VendorQuoteStatus,
  VendorQuoteWithItems,
} from "@/types";
import type { RfqResponseSource } from "@/lib/validations";
import {
  QUOTE_AWARDABLE_RFQ_STATUSES,
  QUOTE_SUBMITTABLE_RFQ_STATUSES,
} from "@/lib/validations";

/**
 * F10 — Vendor Quotes query layer. Sits on top of F9's RFQ tables.
 *
 * Status invariants:
 *  - `submitted` is the only mutable status (vendor can revise via PUT).
 *  - `expired` is set lazily via a check-on-read UPDATE inside list reads
 *    so we don't need a cron job.
 *  - `awarded` / `rejected` are set by the award routes in a single tx
 *    that also locks the RFQ row to prevent concurrent double-awards.
 */

// ── Read helpers ────────────────────────────────────────────────────────────

/**
 * Lazy expiry sweep: flip every `submitted` quote on this RFQ whose
 * `valid_until` has passed to `expired`. Idempotent — re-running on an
 * already-swept RFQ is a no-op. Called inside list/detail reads so the
 * caller always sees current state without a cron.
 */
async function expireStaleQuotes(
  rfqId: string,
  client: import("pg").PoolClient | import("pg").Pool
): Promise<void> {
  await client.query(
    `UPDATE vendor_quote
        SET status = 'expired', updated_at = now()
      WHERE rfq_id = $1
        AND status = 'submitted'
        AND valid_until IS NOT NULL
        AND valid_until < CURRENT_DATE`,
    [rfqId]
  );
}

interface QuoteRow extends VendorQuote {
  vendor_name: string;
  vendor_code: string | null;
}

function mapQuoteRow(r: QuoteRow): Omit<VendorQuoteWithItems, "items"> {
  return {
    id: r.id,
    rfq_id: r.rfq_id,
    vendor_id: r.vendor_id,
    status: r.status,
    response_source: r.response_source,
    received_date: r.received_date,
    entered_by: r.entered_by,
    submitted_at: r.submitted_at,
    valid_until: r.valid_until,
    currency: r.currency,
    delivery_period: r.delivery_period,
    payment_terms: r.payment_terms,
    inclusions: r.inclusions,
    exclusions: r.exclusions,
    notes: r.notes,
    attachments: r.attachments,
    is_late: r.is_late,
    awarded_at: r.awarded_at,
    awarded_by: r.awarded_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    vendor_name: r.vendor_name,
    vendor_code: r.vendor_code,
  };
}

function mapQuoteItemRow(r: VendorQuoteItem): VendorQuoteItem {
  return { ...r, unit_price: Number(r.unit_price) };
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * All quotes for an RFQ, with line items. Sweeps expired quotes first so
 * downstream UI / award flows can rely on `status` being current. Sorted
 * by `is_late ASC, submitted_at ASC` so on-time submissions surface first.
 */
export async function getQuotesByRfq(
  rfqId: string
): Promise<VendorQuoteWithItems[]> {
  const pool = getPool();
  await expireStaleQuotes(rfqId, pool);

  const [headerRes, itemRes] = await Promise.all([
    pool.query<QuoteRow>(
      `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code
         FROM vendor_quote vq
         JOIN vendor v ON v.id = vq.vendor_id
        WHERE vq.rfq_id = $1
        ORDER BY vq.is_late ASC, vq.submitted_at ASC`,
      [rfqId]
    ),
    pool.query<VendorQuoteItem>(
      `SELECT vqi.id, vqi.quote_id, vqi.rfq_item_id, vqi.unit_price,
              vqi.notes, vqi.alternative_spec
         FROM vendor_quote_item vqi
         JOIN vendor_quote vq ON vq.id = vqi.quote_id
        WHERE vq.rfq_id = $1`,
      [rfqId]
    ),
  ]);

  const itemsByQuote = new Map<string, VendorQuoteItem[]>();
  for (const row of itemRes.rows) {
    const mapped = mapQuoteItemRow(row);
    const list = itemsByQuote.get(row.quote_id) ?? [];
    list.push(mapped);
    itemsByQuote.set(row.quote_id, list);
  }

  return headerRes.rows.map((h) => ({
    ...mapQuoteRow(h),
    items: itemsByQuote.get(h.id) ?? [],
  }));
}

/**
 * Single quote with items. Sweeps expiry on the parent RFQ first so a
 * stale `submitted` row gets flipped to `expired` before the read.
 */
export async function getQuoteDetail(
  quoteId: string
): Promise<VendorQuoteWithItems | null> {
  const pool = getPool();

  // We need the rfq_id before we can sweep, so fetch the header first.
  const { rows: headerRows } = await pool.query<QuoteRow>(
    `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code
       FROM vendor_quote vq
       JOIN vendor v ON v.id = vq.vendor_id
      WHERE vq.id = $1`,
    [quoteId]
  );
  const header = headerRows[0];
  if (!header) return null;

  await expireStaleQuotes(header.rfq_id, pool);

  // Re-read so we pick up any expiry flip.
  const { rows: refreshed } = await pool.query<QuoteRow>(
    `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code
       FROM vendor_quote vq
       JOIN vendor v ON v.id = vq.vendor_id
      WHERE vq.id = $1`,
    [quoteId]
  );
  const fresh = refreshed[0];
  if (!fresh) return null;

  const { rows: itemRows } = await pool.query<VendorQuoteItem>(
    `SELECT id, quote_id, rfq_item_id, unit_price, notes, alternative_spec
       FROM vendor_quote_item
      WHERE quote_id = $1`,
    [quoteId]
  );

  return {
    ...mapQuoteRow(fresh),
    items: itemRows.map(mapQuoteItemRow),
  };
}

/**
 * Vendor-portal scope: this vendor's own quote for this RFQ. Returns
 * `null` when the vendor hasn't submitted yet — caller renders the
 * submit form. Sweeps expiry first.
 */
export async function getQuoteForVendor(
  rfqId: string,
  vendorId: string
): Promise<VendorQuoteWithItems | null> {
  const pool = getPool();
  await expireStaleQuotes(rfqId, pool);

  const { rows: headerRows } = await pool.query<QuoteRow>(
    `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code
       FROM vendor_quote vq
       JOIN vendor v ON v.id = vq.vendor_id
      WHERE vq.rfq_id = $1 AND vq.vendor_id = $2`,
    [rfqId, vendorId]
  );
  const header = headerRows[0];
  if (!header) return null;

  const { rows: itemRows } = await pool.query<VendorQuoteItem>(
    `SELECT id, quote_id, rfq_item_id, unit_price, notes, alternative_spec
       FROM vendor_quote_item
      WHERE quote_id = $1`,
    [header.id]
  );

  return {
    ...mapQuoteRow(header),
    items: itemRows.map(mapQuoteItemRow),
  };
}

/**
 * Denormalised comparison view: rows are RFQ items, columns are invited
 * vendors. Lowest-price flag is computed per row (ties → all marked
 * lowest, since "lowest" is the meaningful UX signal regardless of ties).
 * Expired and rejected quotes are still included so the UI can dim them.
 */
export async function getQuoteComparison(
  rfqId: string
): Promise<QuoteComparison> {
  const pool = getPool();
  await expireStaleQuotes(rfqId, pool);

  const [itemRes, quoteRes, quoteItemRes, invitedRes] = await Promise.all([
    pool.query<{
      id: string;
      boq_item_id: string;
      description: string;
      unit: string;
      quantity: string;
      spec_notes: string | null;
      sort_order: number;
    }>(
      `SELECT id, boq_item_id, description, unit, quantity, spec_notes, sort_order
         FROM rfq_item
        WHERE rfq_id = $1
        ORDER BY sort_order, description`,
      [rfqId]
    ),
    pool.query<QuoteRow>(
      `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code
         FROM vendor_quote vq
         JOIN vendor v ON v.id = vq.vendor_id
        WHERE vq.rfq_id = $1`,
      [rfqId]
    ),
    pool.query<VendorQuoteItem & { rfq_item_id: string; quote_id: string }>(
      `SELECT vqi.id, vqi.quote_id, vqi.rfq_item_id, vqi.unit_price,
              vqi.notes, vqi.alternative_spec
         FROM vendor_quote_item vqi
         JOIN vendor_quote vq ON vq.id = vqi.quote_id
        WHERE vq.rfq_id = $1`,
      [rfqId]
    ),
    pool.query<{ vendor_id: string; vendor_name: string }>(
      `SELECT rv.vendor_id, v.company_name AS vendor_name
         FROM rfq_vendor rv
         JOIN vendor v ON v.id = rv.vendor_id
        WHERE rv.rfq_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM vendor_quote vq
             WHERE vq.rfq_id = rv.rfq_id
               AND vq.vendor_id = rv.vendor_id
          )
        ORDER BY lower(v.company_name)`,
      [rfqId]
    ),
  ]);

  // Index quote items by (rfq_item_id, vendor_id) via quote_id → vendor_id.
  const vendorByQuoteId = new Map<string, string>();
  const quoteById = new Map<string, QuoteRow>();
  for (const q of quoteRes.rows) {
    vendorByQuoteId.set(q.id, q.vendor_id);
    quoteById.set(q.id, q);
  }

  // rfq_item_id → vendor_id → quote line
  const lineByRfqItemAndVendor = new Map<
    string,
    Map<
      string,
      {
        quote_id: string;
        quote_item_id: string;
        unit_price: number;
        notes: string | null;
        alternative_spec: string | null;
      }
    >
  >();
  for (const qi of quoteItemRes.rows) {
    const vendorId = vendorByQuoteId.get(qi.quote_id);
    if (!vendorId) continue;
    const map =
      lineByRfqItemAndVendor.get(qi.rfq_item_id) ??
      new Map<
        string,
        {
          quote_id: string;
          quote_item_id: string;
          unit_price: number;
          notes: string | null;
          alternative_spec: string | null;
        }
      >();
    map.set(vendorId, {
      quote_id: qi.quote_id,
      quote_item_id: qi.id,
      unit_price: Number(qi.unit_price),
      notes: qi.notes,
      alternative_spec: qi.alternative_spec,
    });
    lineByRfqItemAndVendor.set(qi.rfq_item_id, map);
  }

  // Build the row objects, computing lowest-price marker per row.
  const items: QuoteComparisonRow[] = itemRes.rows.map((row) => {
    const lines = lineByRfqItemAndVendor.get(row.id) ?? new Map();
    const quantity = Number(row.quantity);

    let min: number | null = null;
    for (const line of lines.values()) {
      if (min === null || line.unit_price < min) min = line.unit_price;
    }

    const vendor_prices: QuoteComparisonRow["vendor_prices"] = {};
    for (const [vendorId, line] of lines) {
      vendor_prices[vendorId] = {
        ...line,
        line_total: line.unit_price * quantity,
        is_lowest: min !== null && line.unit_price === min,
      };
    }

    return {
      rfq_item_id: row.id,
      boq_item_id: row.boq_item_id,
      description: row.description,
      unit: row.unit,
      quantity,
      spec_notes: row.spec_notes,
      sort_order: row.sort_order,
      vendor_prices,
    };
  });

  // Build vendor columns — only vendors that actually submitted a quote.
  const totalByVendor = new Map<string, number>();
  for (const item of items) {
    for (const [vendorId, line] of Object.entries(item.vendor_prices)) {
      totalByVendor.set(
        vendorId,
        (totalByVendor.get(vendorId) ?? 0) + line.line_total
      );
    }
  }

  const vendorColumns: QuoteComparisonVendorColumn[] = quoteRes.rows.map(
    (q) => ({
      vendor_id: q.vendor_id,
      vendor_name: q.vendor_name,
      vendor_code: q.vendor_code,
      quote_id: q.id,
      quote_status: q.status,
      response_source: q.response_source,
      is_late: q.is_late,
      valid_until: q.valid_until,
      delivery_period: q.delivery_period,
      payment_terms: q.payment_terms,
      inclusions: q.inclusions,
      exclusions: q.exclusions,
      currency: q.currency,
      grand_total: totalByVendor.get(q.vendor_id) ?? 0,
      submitted_at: q.submitted_at,
    })
  );
  // Sort vendors: non-expired first, then by grand_total ASC, then by name.
  vendorColumns.sort((a, b) => {
    const aExpired = a.quote_status === "expired" ? 1 : 0;
    const bExpired = b.quote_status === "expired" ? 1 : 0;
    if (aExpired !== bExpired) return aExpired - bExpired;
    if (a.grand_total !== b.grand_total) return a.grand_total - b.grand_total;
    return a.vendor_name.localeCompare(b.vendor_name);
  });

  // Vendors invited but with no quote yet — only those NOT in vendorColumns.
  const respondedVendorIds = new Set(vendorColumns.map((v) => v.vendor_id));
  const invited_no_response = invitedRes.rows
    .filter((v) => !respondedVendorIds.has(v.vendor_id))
    .map((v) => ({ vendor_id: v.vendor_id, vendor_name: v.vendor_name }));

  return {
    rfq_id: rfqId,
    items,
    vendors: vendorColumns,
    invited_no_response,
  };
}

/** Recipient row for studio-side quote notifications. */
export interface QuoteStudioRecipient {
  email: string;
  name: string;
  userId: string;
}

/**
 * Studio-side notification recipients for "quote received" / "quote
 * revised" events. Returns the RFQ creator (when they have a valid email)
 * plus all org owners/admins on the same org as the RFQ — the people who
 * actually drive procurement decisions on the project. Empty list when no
 * recipient can be resolved (caller skips fan-out).
 */
export async function getQuoteStudioRecipients(
  rfqId: string
): Promise<QuoteStudioRecipient[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    user_id: string;
    name: string;
    email: string;
  }>(
    `WITH rfq_meta AS (
       SELECT created_by, org_id FROM rfq WHERE id = $1
     )
     SELECT DISTINCT u.id AS user_id, u.name, u.email
       FROM rfq_meta rm
       JOIN "user" u ON u.id = rm.created_by
      WHERE u.email IS NOT NULL
     UNION
     SELECT DISTINCT u.id AS user_id, u.name, u.email
       FROM rfq_meta rm
       JOIN member m ON m."organizationId" = rm.org_id
       JOIN "user" u ON u.id = m."userId"
      WHERE m.role IN ('owner','admin')
        AND u.email IS NOT NULL`,
    [rfqId]
  );
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    userId: r.user_id,
  }));
}

// ── Mutations ───────────────────────────────────────────────────────────────

export interface SubmitQuoteInputItem {
  rfqItemId: string;
  unitPrice: number;
  notes?: string | null;
  alternativeSpec?: string | null;
}

export interface SubmitQuoteInput {
  validUntil?: string | null;
  currency?: string;
  deliveryPeriod?: string | null;
  paymentTerms?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  notes?: string | null;
  items: SubmitQuoteInputItem[];
}

/**
 * Provenance for a PM-recorded (off-portal) quote. Omitted for portal
 * submissions — those keep the DB defaults (`response_source='portal'`,
 * everything else null) and leave existing columns untouched on revision.
 */
export interface SubmitQuoteMeta {
  responseSource?: RfqResponseSource | null;
  receivedDate?: string | null;
  enteredBy?: string | null;
  attachments?: QuoteAttachment[] | null;
}

/**
 * Idempotent upsert for a vendor's quote on an RFQ. Replaces line items
 * wholesale on revision (drop + bulk insert inside the tx). Validates:
 *   1. RFQ is in a submittable status (issued / quotes_received / under_review).
 *   2. Vendor is on the rfq_vendor invitation list.
 *   3. Every input rfqItemId belongs to this RFQ.
 *   4. Input covers every RFQ item (no partial bids in F10 — keeps
 *      comparison logic simple; "no-bid" UX can come later).
 *   5. If a row already exists, its status must still be `submitted`.
 *
 * `is_late` is computed inside the tx from rfq.response_deadline.
 * On first submission for this RFQ, flips rfq.status `issued -> quotes_received`.
 */
export async function submitOrUpdateQuote(
  rfqId: string,
  vendorId: string,
  input: SubmitQuoteInput,
  meta: SubmitQuoteMeta = {}
): Promise<
  | {
      ok: true;
      quote: VendorQuote;
      isNew: boolean;
      orgId: string;
      projectId: string;
      rfqNumber: string;
      rfqTitle: string;
    }
  | {
      ok: false;
      reason:
        | "rfq_not_found"
        | "rfq_wrong_status"
        | "vendor_not_invited"
        | "missing_items"
        | "extra_items"
        | "quote_locked";
    }
> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rfqRows } = await client.query<{
      id: string;
      status: Rfq["status"];
      response_deadline: string | null;
      org_id: string;
      project_id: string;
      rfq_number: string;
      title: string;
      is_late_now: boolean;
    }>(
      `SELECT id, status, response_deadline, org_id, project_id, rfq_number, title,
              (response_deadline IS NOT NULL AND CURRENT_DATE > response_deadline) AS is_late_now
         FROM rfq WHERE id = $1 FOR UPDATE`,
      [rfqId]
    );
    const rfq = rfqRows[0];
    if (!rfq) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "rfq_not_found" };
    }
    if (
      !(QUOTE_SUBMITTABLE_RFQ_STATUSES as readonly string[]).includes(
        rfq.status
      )
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "rfq_wrong_status" };
    }

    // Vendor must be on the invitation list.
    const { rows: inviteRows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM rfq_vendor WHERE rfq_id = $1 AND vendor_id = $2
       ) AS exists`,
      [rfqId, vendorId]
    );
    if (!inviteRows[0]?.exists) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "vendor_not_invited" };
    }

    // Pull RFQ items to validate coverage.
    const { rows: rfqItemRows } = await client.query<{ id: string }>(
      `SELECT id FROM rfq_item WHERE rfq_id = $1`,
      [rfqId]
    );
    const rfqItemIds = new Set(rfqItemRows.map((r) => r.id));
    const inputIds = new Set(input.items.map((i) => i.rfqItemId));

    if (inputIds.size !== input.items.length) {
      // Duplicate rfqItemId in input.
      await client.query("ROLLBACK");
      return { ok: false, reason: "extra_items" };
    }
    for (const id of inputIds) {
      if (!rfqItemIds.has(id)) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "extra_items" };
      }
    }
    if (inputIds.size !== rfqItemIds.size) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "missing_items" };
    }

    // Check existing quote: if present and not `submitted`, refuse.
    const { rows: existingRows } = await client.query<{
      id: string;
      status: VendorQuoteStatus;
    }>(
      `SELECT id, status FROM vendor_quote
        WHERE rfq_id = $1 AND vendor_id = $2 FOR UPDATE`,
      [rfqId, vendorId]
    );
    const existing = existingRows[0];
    const isNew = !existing;
    if (existing && existing.status !== "submitted") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "quote_locked" };
    }

    const isLate = rfq.is_late_now;
    // Provenance — null on the portal path (COALESCE keeps existing / DB default).
    const responseSource = meta.responseSource ?? null;
    const receivedDate = meta.receivedDate ?? null;
    const enteredBy = meta.enteredBy ?? null;
    const attachmentsJson = meta.attachments
      ? JSON.stringify(meta.attachments)
      : null;

    let quoteId: string;
    let quoteRow: VendorQuote;
    if (existing) {
      const { rows: updated } = await client.query<VendorQuote>(
        `UPDATE vendor_quote
            SET valid_until = $1,
                currency = $2,
                delivery_period = $3,
                payment_terms = $4,
                inclusions = $5,
                exclusions = $6,
                notes = $7,
                is_late = $8,
                response_source = COALESCE($9, response_source),
                received_date = COALESCE($10, received_date),
                entered_by = COALESCE($11, entered_by),
                attachments = COALESCE($12::jsonb, attachments),
                submitted_at = now(),
                updated_at = now()
          WHERE id = $13
          RETURNING *`,
        [
          input.validUntil ?? null,
          input.currency ?? "USD",
          input.deliveryPeriod ?? null,
          input.paymentTerms ?? null,
          input.inclusions ?? null,
          input.exclusions ?? null,
          input.notes ?? null,
          isLate,
          responseSource,
          receivedDate,
          enteredBy,
          attachmentsJson,
          existing.id,
        ]
      );
      quoteId = existing.id;
      quoteRow = updated[0];
      // Replace items wholesale.
      await client.query(`DELETE FROM vendor_quote_item WHERE quote_id = $1`, [
        quoteId,
      ]);
    } else {
      const { rows: inserted } = await client.query<VendorQuote>(
        `INSERT INTO vendor_quote (
            rfq_id, vendor_id, status, valid_until, currency,
            delivery_period, payment_terms, inclusions, exclusions, notes, is_late,
            response_source, received_date, entered_by, attachments
          ) VALUES ($1, $2, 'submitted', $3, $4, $5, $6, $7, $8, $9, $10,
                    COALESCE($11, 'portal'), $12, $13, $14::jsonb)
          RETURNING *`,
        [
          rfqId,
          vendorId,
          input.validUntil ?? null,
          input.currency ?? "USD",
          input.deliveryPeriod ?? null,
          input.paymentTerms ?? null,
          input.inclusions ?? null,
          input.exclusions ?? null,
          input.notes ?? null,
          isLate,
          responseSource,
          receivedDate,
          enteredBy,
          attachmentsJson,
        ]
      );
      quoteRow = inserted[0];
      quoteId = quoteRow.id;
    }

    // Bulk-insert line items via parallel unnest arrays — single round-trip.
    await client.query(
      `INSERT INTO vendor_quote_item (quote_id, rfq_item_id, unit_price, notes, alternative_spec)
         SELECT $1::uuid, rfq_item_id, unit_price, notes, alt_spec
           FROM UNNEST(
             $2::uuid[], $3::numeric[], $4::text[], $5::text[]
           ) AS t(rfq_item_id, unit_price, notes, alt_spec)`,
      [
        quoteId,
        input.items.map((i) => i.rfqItemId),
        input.items.map((i) => String(i.unitPrice)),
        input.items.map((i) => i.notes ?? null),
        input.items.map((i) => i.alternativeSpec ?? null),
      ]
    );

    // On first quote for this RFQ, flip status issued -> quotes_received.
    if (rfq.status === "issued") {
      await client.query(
        `UPDATE rfq SET status = 'quotes_received', updated_at = now()
          WHERE id = $1 AND status = 'issued'`,
        [rfqId]
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      quote: quoteRow,
      isNew,
      orgId: rfq.org_id,
      projectId: rfq.project_id,
      rfqNumber: rfq.rfq_number,
      rfqTitle: rfq.title,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Manual flip from `submitted -> under_review`. Optional UX nicety; the
 * award flow accepts both statuses, so this isn't required for the
 * pipeline to work.
 */
export async function setQuoteUnderReview(
  quoteId: string
): Promise<
  | { ok: true; quote: VendorQuote }
  | { ok: false; reason: "not_found" | "wrong_status" }
> {
  const pool = getPool();
  const { rows } = await pool.query<VendorQuote>(
    `UPDATE vendor_quote
        SET status = 'under_review', updated_at = now()
      WHERE id = $1 AND status = 'submitted'
      RETURNING *`,
    [quoteId]
  );
  if (rows[0]) return { ok: true, quote: rows[0] };
  const { rows: probe } = await pool.query<{ id: string }>(
    `SELECT id FROM vendor_quote WHERE id = $1`,
    [quoteId]
  );
  if (probe.length === 0) return { ok: false, reason: "not_found" };
  return { ok: false, reason: "wrong_status" };
}

// ── Award flows ─────────────────────────────────────────────────────────────

interface SingleAwardResult {
  ok: true;
  rfq: Rfq;
  winningVendorId: string;
  winningVendorName: string;
}
interface SplitAwardResult {
  ok: true;
  rfq: Rfq;
}
type AwardFailure = {
  ok: false;
  reason:
    | "rfq_not_found"
    | "rfq_wrong_status"
    | "quote_not_found"
    | "quote_expired"
    | "incomplete_split";
};

/**
 * Award the entire RFQ to a single vendor. Locks the RFQ row, asserts
 * the winning quote is bid-able, then:
 *   - winning quote → `awarded`, awarded_at/awarded_by set
 *   - all other quotes on this RFQ → `rejected`
 *   - rfq.status → `awarded`, award_date = today, awarded_vendor_id set
 *   - every boq_item referenced by the RFQ → po_status `quoted` (from
 *     `rfq_issued`). Doesn't downgrade items already further along.
 */
export async function awardRfqSingle(
  rfqId: string,
  winningQuoteId: string,
  actorId: string
): Promise<SingleAwardResult | AwardFailure> {
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
      return { ok: false, reason: "rfq_not_found" };
    }
    if (
      !(QUOTE_AWARDABLE_RFQ_STATUSES as readonly string[]).includes(rfq.status)
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "rfq_wrong_status" };
    }

    // Sweep expiry inside the tx so we can't race a vendor's valid_until.
    await expireStaleQuotes(rfqId, client);

    const { rows: quoteRows } = await client.query<{
      id: string;
      vendor_id: string;
      status: VendorQuoteStatus;
      vendor_name: string;
    }>(
      `SELECT vq.id, vq.vendor_id, vq.status, v.company_name AS vendor_name
         FROM vendor_quote vq
         JOIN vendor v ON v.id = vq.vendor_id
        WHERE vq.id = $1 AND vq.rfq_id = $2
        FOR UPDATE OF vq`,
      [winningQuoteId, rfqId]
    );
    const winner = quoteRows[0];
    if (!winner) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "quote_not_found" };
    }
    if (winner.status !== "submitted" && winner.status !== "under_review") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "quote_expired" };
    }

    // Winner -> awarded.
    await client.query(
      `UPDATE vendor_quote
          SET status = 'awarded',
              awarded_at = now(),
              awarded_by = $2,
              updated_at = now()
        WHERE id = $1`,
      [winner.id, actorId]
    );
    // Losers -> rejected.
    await client.query(
      `UPDATE vendor_quote
          SET status = 'rejected', updated_at = now()
        WHERE rfq_id = $1
          AND id <> $2
          AND status IN ('submitted','under_review')`,
      [rfqId, winner.id]
    );

    // RFQ -> awarded.
    const { rows: updatedRfq } = await client.query<Rfq>(
      `UPDATE rfq
          SET status = 'awarded',
              award_date = CURRENT_DATE,
              awarded_vendor_id = $2,
              updated_at = now()
        WHERE id = $1
       RETURNING *`,
      [rfqId, winner.vendor_id]
    );

    // BOQ items -> quoted (only when currently rfq_issued).
    await client.query(
      `UPDATE boq_item bi
          SET po_status = 'quoted', updated_at = now()
         FROM rfq_item ri
        WHERE ri.rfq_id = $1
          AND ri.boq_item_id = bi.id
          AND bi.po_status = 'rfq_issued'`,
      [rfqId]
    );

    await client.query("COMMIT");
    return {
      ok: true,
      rfq: updatedRfq[0],
      winningVendorId: winner.vendor_id,
      winningVendorName: winner.vendor_name,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface SplitAward {
  rfqItemId: string;
  quoteItemId: string;
}

/**
 * Per-item award. Different items can go to different vendors. Requires
 * every RFQ item to be assigned (no partial splits — keeps `rfq.awarded`
 * semantics clean). Quote items that win flip their parent quote to
 * `awarded`; quotes with no wins flip to `rejected`.
 */
export async function awardRfqSplit(
  rfqId: string,
  awards: readonly SplitAward[],
  actorId: string
): Promise<SplitAwardResult | AwardFailure> {
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
      return { ok: false, reason: "rfq_not_found" };
    }
    if (
      !(QUOTE_AWARDABLE_RFQ_STATUSES as readonly string[]).includes(rfq.status)
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "rfq_wrong_status" };
    }

    await expireStaleQuotes(rfqId, client);

    // Fetch all RFQ items to enforce full coverage.
    const { rows: rfqItemRows } = await client.query<{ id: string }>(
      `SELECT id FROM rfq_item WHERE rfq_id = $1`,
      [rfqId]
    );
    const rfqItemSet = new Set(rfqItemRows.map((r) => r.id));
    const inputItemSet = new Set(awards.map((a) => a.rfqItemId));
    if (inputItemSet.size !== awards.length) {
      // Duplicate rfqItemId in input.
      await client.query("ROLLBACK");
      return { ok: false, reason: "incomplete_split" };
    }
    if (inputItemSet.size !== rfqItemSet.size) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "incomplete_split" };
    }
    for (const id of inputItemSet) {
      if (!rfqItemSet.has(id)) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "incomplete_split" };
      }
    }

    // Validate quote items: each must belong to a non-expired quote on this RFQ.
    const quoteItemIds = awards.map((a) => a.quoteItemId);
    const { rows: qiRows } = await client.query<{
      id: string;
      rfq_item_id: string;
      quote_id: string;
      vendor_id: string;
      quote_status: VendorQuoteStatus;
    }>(
      `SELECT vqi.id, vqi.rfq_item_id, vqi.quote_id,
              vq.vendor_id, vq.status AS quote_status
         FROM vendor_quote_item vqi
         JOIN vendor_quote vq ON vq.id = vqi.quote_id
        WHERE vqi.id = ANY($1::uuid[])
          AND vq.rfq_id = $2`,
      [quoteItemIds, rfqId]
    );
    if (qiRows.length !== awards.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "quote_not_found" };
    }
    const qiById = new Map(qiRows.map((r) => [r.id, r]));
    for (const award of awards) {
      const qi = qiById.get(award.quoteItemId);
      if (!qi) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "quote_not_found" };
      }
      if (qi.rfq_item_id !== award.rfqItemId) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "quote_not_found" };
      }
      if (qi.quote_status === "expired") {
        await client.query("ROLLBACK");
        return { ok: false, reason: "quote_expired" };
      }
    }

    // Apply per-item awards via a single bulk UPDATE — keeps the tx
    // round-trip count constant regardless of N.
    await client.query(
      `UPDATE rfq_item ri
          SET awarded_quote_item_id = t.quote_item_id,
              awarded_vendor_id     = t.vendor_id
         FROM UNNEST($1::uuid[], $2::uuid[], $3::uuid[])
              AS t(rfq_item_id, quote_item_id, vendor_id)
        WHERE ri.id     = t.rfq_item_id
          AND ri.rfq_id = $4`,
      [
        awards.map((a) => a.rfqItemId),
        awards.map((a) => a.quoteItemId),
        awards.map((a) => qiById.get(a.quoteItemId)!.vendor_id),
        rfqId,
      ]
    );

    // Mark winning quotes as awarded — dedup by quote_id.
    const winningQuoteIds = Array.from(new Set(qiRows.map((r) => r.quote_id)));
    await client.query(
      `UPDATE vendor_quote
          SET status = 'awarded',
              awarded_at = now(),
              awarded_by = $2,
              updated_at = now()
        WHERE id = ANY($1::uuid[])
          AND status IN ('submitted','under_review')`,
      [winningQuoteIds, actorId]
    );
    // Other quotes -> rejected.
    await client.query(
      `UPDATE vendor_quote
          SET status = 'rejected', updated_at = now()
        WHERE rfq_id = $1
          AND NOT (id = ANY($2::uuid[]))
          AND status IN ('submitted','under_review')`,
      [rfqId, winningQuoteIds]
    );

    // RFQ -> awarded. No single awarded_vendor_id when split.
    const { rows: updatedRfq } = await client.query<Rfq>(
      `UPDATE rfq
          SET status = 'awarded',
              award_date = CURRENT_DATE,
              awarded_vendor_id = NULL,
              updated_at = now()
        WHERE id = $1
       RETURNING *`,
      [rfqId]
    );

    await client.query(
      `UPDATE boq_item bi
          SET po_status = 'quoted', updated_at = now()
         FROM rfq_item ri
        WHERE ri.rfq_id = $1
          AND ri.boq_item_id = bi.id
          AND bi.po_status = 'rfq_issued'`,
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
