import { getPool } from "@/lib/db";
import { getUsersByIds } from "./users";
import type {
  QuoteEvidence,
  QuoteComparison,
  QuoteComparisonRow,
  QuoteComparisonVendorColumn,
  Rfq,
  VendorQuote,
  VendorQuoteItem,
  VendorQuoteStatus,
  VendorQuoteWithItems,
} from "@/types";
import type { RfqResponseSource, QuoteEvidenceInput } from "@/lib/validations";
import {
  QUOTE_AWARDABLE_RFQ_STATUSES,
  QUOTE_SUBMITTABLE_RFQ_STATUSES,
  REVISABLE_QUOTE_STATUSES,
} from "@/lib/validations";

/** A fresh submission may overwrite these (revise a quote, or un-decline). */
function isRevisableQuote(status: VendorQuoteStatus): boolean {
  return (REVISABLE_QUOTE_STATUSES as readonly VendorQuoteStatus[]).includes(
    status
  );
}

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
        AND is_current
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
    version: r.version,
    is_current: r.is_current,
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
        WHERE vq.rfq_id = $1 AND vq.is_current
        ORDER BY vq.is_late ASC, vq.submitted_at ASC`,
      [rfqId]
    ),
    pool.query<VendorQuoteItem>(
      `SELECT vqi.id, vqi.quote_id, vqi.rfq_item_id, vqi.unit_price,
              vqi.notes, vqi.alternative_spec
         FROM vendor_quote_item vqi
         JOIN vendor_quote vq ON vq.id = vqi.quote_id
        WHERE vq.rfq_id = $1 AND vq.is_current`,
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

  const quotes = headerRes.rows.map((h) => ({
    ...mapQuoteRow(h),
    items: itemsByQuote.get(h.id) ?? [],
  }));

  await resolveEvidenceUploaders(quotes);
  return quotes;
}

/**
 * Resolve evidence `uploadedBy` ids to display names (§15) in one batched
 * lookup across every quote, tagging each attachment with `uploadedByName`. The
 * id stays stored; the name is joined at read time (as the document module does).
 */
async function resolveEvidenceUploaders(
  quotes: VendorQuoteWithItems[]
): Promise<void> {
  const ids = Array.from(
    new Set(
      quotes.flatMap((q) =>
        (q.attachments ?? [])
          .map((a) => a.uploadedBy)
          .filter((x): x is string => !!x)
      )
    )
  );
  if (ids.length === 0) return;

  const users = await getUsersByIds(ids);
  const nameById = new Map<string, string>(
    users.map((u): [string, string] => [u.id, u.name])
  );
  for (const q of quotes) {
    if (!q.attachments) continue;
    q.attachments = q.attachments.map((a) => ({
      ...a,
      uploadedByName: a.uploadedBy
        ? (nameById.get(a.uploadedBy) ?? null)
        : null,
    }));
  }
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
      WHERE vq.rfq_id = $1 AND vq.vendor_id = $2 AND vq.is_current`,
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
      proposed_price: string | null;
    }>(
      `SELECT id, boq_item_id, description, unit, quantity, spec_notes, sort_order,
              proposed_price
         FROM rfq_item
        WHERE rfq_id = $1
        ORDER BY sort_order, description`,
      [rfqId]
    ),
    pool.query<
      QuoteRow & { vendor_rating: string | null; prior_awards: string }
    >(
      // prior_awards = distinct *logical* RFQs (by rfq_number) this vendor has
      // won — single (rfq.awarded_vendor_id) or split (rfq_item.awarded_vendor_id).
      // "Live wins only": superseded revisions are excluded, and the current
      // RFQ's own number is excluded so earlier versions of it don't count.
      // Org-scoped so the awarded_vendor_id partial indexes can be used.
      `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code,
              v.rating AS vendor_rating,
              (SELECT COUNT(DISTINCT r.rfq_number)
                 FROM rfq r
                WHERE r.org_id = (SELECT org_id FROM rfq WHERE id = $1)
                  AND r.status <> 'superseded'
                  AND r.rfq_number <> (SELECT rfq_number FROM rfq WHERE id = $1)
                  AND (r.awarded_vendor_id = vq.vendor_id
                       OR EXISTS (
                         SELECT 1 FROM rfq_item ri
                          WHERE ri.rfq_id = r.id
                            AND ri.awarded_vendor_id = vq.vendor_id
                       ))
              ) AS prior_awards
         FROM vendor_quote vq
         JOIN vendor v ON v.id = vq.vendor_id
        WHERE vq.rfq_id = $1 AND vq.is_current`,
      [rfqId]
    ),
    pool.query<VendorQuoteItem & { rfq_item_id: string; quote_id: string }>(
      `SELECT vqi.id, vqi.quote_id, vqi.rfq_item_id, vqi.unit_price,
              vqi.notes, vqi.alternative_spec
         FROM vendor_quote_item vqi
         JOIN vendor_quote vq ON vq.id = vqi.quote_id
        WHERE vq.rfq_id = $1 AND vq.is_current`,
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
               AND vq.is_current
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
      proposed_price:
        row.proposed_price === null ? null : Number(row.proposed_price),
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
      vendor_rating: q.vendor_rating === null ? null : Number(q.vendor_rating),
      vendor_prior_awards: Number(q.prior_awards),
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
 * Every version of a vendor's quote on an RFQ (current + superseded), newest
 * first, with line items. Keyed off any one version's `quoteId` — resolves the
 * vendor, then returns the full history for that (rfq, vendor).
 */
export async function getQuoteVersionHistory(
  rfqId: string,
  quoteId: string
): Promise<VendorQuoteWithItems[]> {
  const pool = getPool();
  const { rows: vendorRows } = await pool.query<{ vendor_id: string }>(
    `SELECT vendor_id FROM vendor_quote WHERE id = $1 AND rfq_id = $2`,
    [quoteId, rfqId]
  );
  const vendorId = vendorRows[0]?.vendor_id;
  if (!vendorId) return [];

  const [headerRes, itemRes] = await Promise.all([
    pool.query<QuoteRow>(
      `SELECT vq.*, v.company_name AS vendor_name, v.vendor_code
         FROM vendor_quote vq
         JOIN vendor v ON v.id = vq.vendor_id
        WHERE vq.rfq_id = $1 AND vq.vendor_id = $2
        ORDER BY vq.version DESC`,
      [rfqId, vendorId]
    ),
    pool.query<VendorQuoteItem>(
      `SELECT vqi.id, vqi.quote_id, vqi.rfq_item_id, vqi.unit_price,
              vqi.notes, vqi.alternative_spec
         FROM vendor_quote_item vqi
         JOIN vendor_quote vq ON vq.id = vqi.quote_id
        WHERE vq.rfq_id = $1 AND vq.vendor_id = $2`,
      [rfqId, vendorId]
    ),
  ]);

  const itemsByQuote = new Map<string, VendorQuoteItem[]>();
  for (const it of itemRes.rows) {
    const arr = itemsByQuote.get(it.quote_id) ?? [];
    arr.push(mapQuoteItemRow(it));
    itemsByQuote.set(it.quote_id, arr);
  }
  return headerRes.rows.map((h) => ({
    ...mapQuoteRow(h),
    items: itemsByQuote.get(h.id) ?? [],
  }));
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
  /** Evidence files as supplied by the client (provenance is server-stamped). */
  attachments?: QuoteEvidenceInput[] | null;
  /** User uploading the evidence (PM for manual entry, vendor for portal). */
  uploaderId?: string | null;
}

/**
 * Stamp client-supplied evidence with server-owned provenance (§15). New files
 * get `uploadedBy`/`uploadedAt`/`source` set now; files that already existed on
 * the prior version (matched by url) keep their original provenance so a
 * revision never rewrites history. The client's `fileType`/`notes` are kept.
 */
export function stampQuoteEvidence(
  input: readonly QuoteEvidenceInput[],
  prior: readonly QuoteEvidence[],
  opts: { uploaderId: string | null; source: RfqResponseSource; at: string }
): QuoteEvidence[] {
  const priorByUrl = new Map(prior.map((a) => [a.url, a]));
  return input.map((a) => {
    const p = priorByUrl.get(a.url);
    return {
      url: a.url,
      fileName: a.fileName,
      fileType: a.fileType ?? null,
      notes: a.notes ?? null,
      uploadedBy: p?.uploadedBy ?? opts.uploaderId ?? null,
      uploadedAt: p?.uploadedAt ?? opts.at,
      source: p?.source ?? opts.source,
    };
  });
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
    // Partial bids are allowed (§14): a vendor may price some, all, or (via a
    // single blank line) none of the items — "no bid" is simply the absence of
    // a `vendor_quote_item`. Only reject items that aren't part of this RFQ.
    for (const id of inputIds) {
      if (!rfqItemIds.has(id)) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "extra_items" };
      }
    }

    // The current version (if any). A revision retires it and inserts a new
    // version row — line items stay attached to their version, so history is
    // preserved. Only a `submitted` current version may be revised.
    const { rows: existingRows } = await client.query<{
      id: string;
      status: VendorQuoteStatus;
      version: number;
      attachments: QuoteEvidence[] | null;
    }>(
      `SELECT id, status, version, attachments FROM vendor_quote
        WHERE rfq_id = $1 AND vendor_id = $2 AND is_current
        FOR UPDATE`,
      [rfqId, vendorId]
    );
    const existing = existingRows[0];
    const isNew = !existing;
    // A `submitted` quote can be revised; a `declined` one can be replaced with
    // a real submission (§14 un-decline). Awarded/rejected/expired are locked.
    if (existing && !isRevisableQuote(existing.status)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "quote_locked" };
    }

    const isLate = rfq.is_late_now;
    const responseSource = meta.responseSource ?? null;
    const receivedDate = meta.receivedDate ?? null;
    const enteredBy = meta.enteredBy ?? null;

    // Stamp evidence provenance server-side (§15), preserving original
    // uploader/date/source across revisions (matched by url).
    const stampedAttachments =
      meta.attachments && meta.attachments.length > 0
        ? stampQuoteEvidence(meta.attachments, existing?.attachments ?? [], {
            uploaderId: meta.uploaderId ?? null,
            source: responseSource ?? "portal",
            at: new Date().toISOString(),
          })
        : null;
    const attachmentsJson = stampedAttachments
      ? JSON.stringify(stampedAttachments)
      : null;

    // Retire the current version before inserting the new one (keeps the
    // partial-unique "one current per rfq+vendor" invariant satisfied).
    if (existing) {
      await client.query(
        `UPDATE vendor_quote SET is_current = false, updated_at = now()
          WHERE id = $1`,
        [existing.id]
      );
    }
    const version = existing ? existing.version + 1 : 1;

    const { rows: inserted } = await client.query<VendorQuote>(
      `INSERT INTO vendor_quote (
          rfq_id, vendor_id, status, version, is_current, valid_until, currency,
          delivery_period, payment_terms, inclusions, exclusions, notes, is_late,
          response_source, received_date, entered_by, attachments
        ) VALUES ($1, $2, 'submitted', $3, true, $4, $5, $6, $7, $8, $9, $10, $11,
                  COALESCE($12, 'portal'), $13, $14, $15::jsonb)
        RETURNING *`,
      [
        rfqId,
        vendorId,
        version,
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
    const quoteRow = inserted[0];
    const quoteId = quoteRow.id;

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
 * §14: record that a vendor won't quote this RFQ — a current `vendor_quote` row
 * with status `declined` and zero line items (reason → `notes`). Retires the
 * vendor's prior current version so history is preserved. Can decline from
 * scratch, over a `submitted` quote, or re-decline; awarded/rejected/expired are
 * locked. Does NOT flip the RFQ to `quotes_received` — a decline isn't a quote.
 */
export async function declineQuote(
  rfqId: string,
  vendorId: string,
  meta: {
    reason?: string | null;
    responseSource?: RfqResponseSource | null;
    enteredBy?: string | null;
  } = {}
): Promise<
  | {
      ok: true;
      quote: VendorQuote;
      orgId: string;
      projectId: string;
      rfqNumber: string;
      vendorName: string;
    }
  | {
      ok: false;
      reason:
        | "rfq_not_found"
        | "rfq_wrong_status"
        | "vendor_not_invited"
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
      org_id: string;
      project_id: string;
      rfq_number: string;
      is_late_now: boolean;
    }>(
      `SELECT id, status, org_id, project_id, rfq_number,
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

    // Vendor must be invited; grab the name for the studio notification.
    const { rows: vendorRows } = await client.query<{ company_name: string }>(
      `SELECT v.company_name
         FROM rfq_vendor rv JOIN vendor v ON v.id = rv.vendor_id
        WHERE rv.rfq_id = $1 AND rv.vendor_id = $2`,
      [rfqId, vendorId]
    );
    const vendorName = vendorRows[0]?.company_name;
    if (!vendorName) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "vendor_not_invited" };
    }

    const { rows: existingRows } = await client.query<{
      id: string;
      status: VendorQuoteStatus;
      version: number;
    }>(
      `SELECT id, status, version FROM vendor_quote
        WHERE rfq_id = $1 AND vendor_id = $2 AND is_current
        FOR UPDATE`,
      [rfqId, vendorId]
    );
    const existing = existingRows[0];
    if (existing && !isRevisableQuote(existing.status)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "quote_locked" };
    }

    if (existing) {
      await client.query(
        `UPDATE vendor_quote SET is_current = false, updated_at = now()
          WHERE id = $1`,
        [existing.id]
      );
    }
    const version = existing ? existing.version + 1 : 1;

    // A decline carries no line items; `currency` falls back to its default.
    const { rows: inserted } = await client.query<VendorQuote>(
      `INSERT INTO vendor_quote (
          rfq_id, vendor_id, status, version, is_current, notes, is_late,
          response_source, entered_by
        ) VALUES ($1, $2, 'declined', $3, true, $4, $5, COALESCE($6, 'portal'), $7)
        RETURNING *`,
      [
        rfqId,
        vendorId,
        version,
        meta.reason ?? null,
        rfq.is_late_now,
        meta.responseSource ?? null,
        meta.enteredBy ?? null,
      ]
    );

    await client.query("COMMIT");
    return {
      ok: true,
      quote: inserted[0],
      orgId: rfq.org_id,
      projectId: rfq.project_id,
      rfqNumber: rfq.rfq_number,
      vendorName,
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
      WHERE id = $1 AND status = 'submitted' AND is_current
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
    | "incomplete_quote"
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
        WHERE vq.id = $1 AND vq.rfq_id = $2 AND vq.is_current
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

    // Now that partial bids are allowed (§14), a single-vendor award must still
    // cover the whole RFQ — otherwise items would be left unpriced. Reject when
    // the winning quote hasn't bid on every item (use split award instead).
    const { rows: coverageRows } = await client.query<{
      total_items: string;
      covered_items: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM rfq_item WHERE rfq_id = $1) AS total_items,
         (SELECT COUNT(*) FROM vendor_quote_item vqi
            JOIN rfq_item ri ON ri.id = vqi.rfq_item_id AND ri.rfq_id = $1
           WHERE vqi.quote_id = $2) AS covered_items`,
      [rfqId, winner.id]
    );
    const coverage = coverageRows[0];
    if (
      !coverage ||
      Number(coverage.covered_items) < Number(coverage.total_items)
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "incomplete_quote" };
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
          AND is_current
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
          AND vq.rfq_id = $2
          AND vq.is_current`,
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
          AND is_current
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
