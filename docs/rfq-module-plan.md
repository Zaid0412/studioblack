# RFQ & Vendor Quotation module — completion plan

Closes the gaps between the shipped RFQ feature (F9/F10) and the two RFQ PRDs
(`RFQ - NEW.docx`, `RFQ - detailed REQ NEW.docx`). Written 2026-07-02.

Four tracks, ranked by value:

1. **RFQ-1** — manual / multi-channel quote entry + response source + evidence
2. **RFQ-2** — quote versioning
3. **RFQ-3** — scope change → RFQ revisions (large; likely several PRs)
4. **RFQ-4** — smaller items (BOQ eligibility gate, package name/type, comms timeline)

---

## 0. Current state (built — do NOT rebuild)

**Tables (exact columns, dev-verified):**

- `rfq`: id, org_id, project_id, rfq_number, title, **status**, issued_date, response_deadline, award_date, awarded_vendor_id, scope_of_work, terms_conditions, attachments (jsonb), created_by, created_at, updated_at
- `rfq_item`: id, rfq_id, boq_item_id, description, unit, quantity, spec_notes, sort_order, awarded_vendor_id, awarded_quote_item_id
- `rfq_vendor`: rfq_id, vendor_id, invited_at, invited_by
- `vendor_quote`: id, rfq_id, vendor_id, status, submitted_at, valid_until, currency, delivery_period, payment_terms, inclusions, exclusions, notes, **attachments (jsonb — reserved, no UI)**, is_late, awarded_at, awarded_by, created_at, updated_at
- `vendor_quote_item`: id, quote_id, rfq_item_id, unit_price, notes, alternative_spec

**Statuses:** `rfq` = draft/issued/quotes_received/under_review/awarded/cancelled · `vendor_quote` = submitted/under_review/awarded/rejected/expired.

**Queries:** `src/lib/queries/rfqs.ts`, `src/lib/queries/quotes.ts` (`submitOrUpdateQuote` = in-place overwrite; `getQuoteComparison`; `awardRfqSingle`/`awardRfqSplit`; `getSuggestedVendorsForRfq`).

**Studio routes:** `src/app/api/projects/[id]/rfqs/` — `route.ts` (list/create), `[rfqId]/` (get/patch), `/issue`, `/invite`, `/cancel`, `/suggested-vendors`, `/items`, `/quotes`, `/quotes/[quoteId]` (+`/review`), `/comparison`, `/award`, `/award-split`.
**Vendor-portal routes:** `src/app/api/vendor-portal/rfqs/` — list, `[rfqId]`, `[rfqId]/quote` (GET + PUT submit/revise).
**UI:** studio `src/app/(dashboard)/projects/[id]/order/rfq/**` (new / [rfqId] / comparison / `QuoteAwardDialog`); vendor `src/app/(dashboard)/vendor-portal/rfqs/**`.
**Audit:** `rfq.created/updated/issued/vendors_added/cancelled/awarded`, `quote.submitted/revised/under_review/awarded/rejected/expired`.
**BOQ link:** `boq_item.po_status` (none→rfq_issued→quoted→po_raised→delivered).

**Already covers (don't touch):** one RFQ→many items→many vendors, service-area vendor suggestion, quote comparison matrix, **split award** (per-item), vendor portal submit/revise, RFQ+quote audit trail.

---

## 1. RFQ-1 — Manual / multi-channel quote entry + evidence ⬅ START HERE

**Why:** PRD §7–8, §16 — most vendors won't use the portal (email/WhatsApp/phone). Today a quote can only arrive via the vendor-portal `PUT`. This lets a PM record a quote received off-channel, tags how it arrived, and attaches the evidence (the emailed PDF/Excel/screenshot). Highest real-world unlock. **Self-contained.**

**Schema** (`migrate-rfq-quote-source.sql`)

- `vendor_quote`: `ADD response_source TEXT` (CHECK in portal/email/whatsapp/phone/pdf/excel/manual), `ADD received_date DATE`, `ADD entered_by TEXT` (studio user who keyed it — null when vendor-submitted). Backfill existing rows `response_source='portal'`.
- `rfq_vendor`: `ADD distribution_method TEXT` (portal/email/whatsapp/manual), `ADD sent_date TIMESTAMPTZ`, `ADD sent_by TEXT` — how the RFQ was distributed (optional but cheap; set on issue/invite).
- **Evidence:** reuse the existing `vendor_quote.attachments` jsonb → `[{name,url,source,uploaded_by,uploaded_at}]`. No new table for v1.

**Backend** (`quotes.ts`)

- Add `enterQuoteForVendor(orgId, rfqId, { vendorId, responseSource, receivedDate, currency, validUntil, paymentTerms, deliveryPeriod, notes, items[], attachments[] }, actor)` — like `submitOrUpdateQuote` but: (a) callable studio-side for any invited vendor, (b) stamps `response_source`/`received_date`/`entered_by`. If the vendor isn't yet an `rfq_vendor`, add them (or require invite first — decide: auto-invite on manual entry).
- `submitOrUpdateQuote` (portal path) stays; set `response_source='portal'`.

**Validation** (`validations.ts`): `enterQuoteSchema` — manual entry requires `responseSource`, `receivedDate`; items `[{ rfqItemId, unitPrice, notes? }]`. `RFQ_RESPONSE_SOURCES` enum.

**API**

- `POST /api/projects/[id]/rfqs/[rfqId]/quotes` (NEW, studio, pm/architect) — create/update a quote on behalf of a vendor. (GET already exists.)
- Evidence upload: reuse the existing attachment-upload pattern (Supabase storage) → append to `vendor_quote.attachments`. Either a sub-route `/quotes/[quoteId]/attachments` or include signed uploads in the payload.

**UI** (`order/rfq/[rfqId]`)

- "Enter quote" action per invited vendor (and per-RFQ) → dialog: vendor select, **response source** (Select), received date (DatePicker), currency, validity, payment terms, per-item unit prices, remarks, **evidence upload** (FileUploadSlot).
- Comparison + quote rows: show a **response-source badge**; show evidence thumbnails/links.
- i18n en+tr.

**Tests:** `enterQuoteSchema` (manual requires source/date), `POST /quotes` route (200/400/403/404), source badge render. Update `src/test/setup.ts` mock for the new query.

**Effort:** Med. **Migration:** yes (additive + backfill).

---

## 2. RFQ-2 — Quote versioning

**Why:** PRD §18 — a vendor may submit multiple times; keep history, previous versions read-only. Today `submitOrUpdateQuote` overwrites the row and bulk-replaces items → history lost (the thing the doc explicitly warns against).

**Schema** (`migrate-vendor-quote-versions.sql`)

- `vendor_quote_version`: id, quote_id (FK), version_number, response_source, received_date, submitted_at, currency, payment_terms, delivery_period, notes, **items jsonb** (snapshot of `vendor_quote_item` rows), created_by, created_at. (Snapshot table — simplest; keeps `vendor_quote` as the "current".)

**Backend**

- Before any update in `submitOrUpdateQuote`/`enterQuoteForVendor`, snapshot the current `vendor_quote` (+ its items) into `vendor_quote_version` with the next `version_number`. Then update current in place.
- `getQuoteVersionHistory(orgId, quoteId)`.

**API:** `GET /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/versions`.
**UI:** version-history disclosure on the quote (mirror the attachment version-history UX). Badge "v3 · via WhatsApp".
**Tests:** snapshot-on-resubmit, history query, versions route.
**Effort:** Med. **Depends on:** RFQ-1 (share the snapshot in both entry paths). **Migration:** yes.

---

## 3. RFQ-3 — Scope change → RFQ revisions (LARGE — split into sub-PRs)

**Why:** `RFQ - NEW.docx` 2nd half — scope changes happen on every project. Never overwrite BOQ qty/spec; version it and create RFQ revisions.

**Schema** (`migrate-boq-item-versions.sql`, `migrate-rfq-revisions.sql`)

- `boq_item_version`: id, boq_item_id, version_number, change_reason (quantity/specification/scope_add/scope_remove), changed_by, changed_at, snapshot jsonb (immutable). BOQ edits to qty/spec snapshot first.
- `rfq` revisioning: `ADD revision_number INT DEFAULT 0`, `ADD supersedes_rfq_id UUID` (self-ref); a revision clones the RFQ into a new row and marks the old `superseded`. New rfq status `revised`/`superseded`.

**Backend / rules (procurement-impact matrix, PRD §22):**

- Qty only → update RFQ item / reuse rate. Spec changed → require re-quote (new RFQ revision). New item → new RFQ or add to revision. Deleted item → cancel RFQ item.
- Scope-change approval workflow: requested → internal review → client approval → approved (mirror the rate-contract state-machine pattern from PR C).

**Change Orders (after PO):** only if POs exist. **Check `po`/`purchase_order` tables first** — if procurement-execution (PO) isn't built, change orders are **out of scope**; stop RFQ-3 at RFQ-revision level and defer COs.

**UI:** BOQ-item revision history; RFQ "Rev-1" banner + supersede link; vendor re-quote notification; scope-change approval actions.
**Tests:** revision clone, impact-rule routing, approval transitions.
**Effort:** High — **plan as 2-3 sub-PRs** (BOQ-item versioning → RFQ revisions → scope-change approval). Sequence LAST.

---

## 4. RFQ-4 — Smaller items (fold in opportunistically)

- **BOQ eligibility gate** — enforce only client-approved / ready-for-procurement BOQ items can enter an RFQ. Add a status check in `createRfq`/`addRfqItems` (today it's implicit via `po_status`). Small; do early. Migration: none.
- **RFQ package name/type** — `rfq` `ADD package_type TEXT` (material/labor/equipment/subcontract/other; multi via array or a join). `title` already serves as package name. Overlaps with RFQ-1's distribution work — do together. Migration: additive.
- **Dedicated `rfq_communications` timeline** — table (id, rfq_id, vendor_id, date, user, action, channel, remarks) + a timeline UI on the RFQ. Today derived from `audit_event`. Lower priority — only if the audit-derived timeline proves insufficient. Migration: new table.

---

## Sequencing

1. **RFQ-1** (manual/multi-channel entry + evidence) + fold in **RFQ-4** package_type & BOQ eligibility gate (overlapping surface). One PR, maybe two.
2. **RFQ-2** (quote versioning) — builds on RFQ-1's entry paths.
3. **RFQ-3** (scope change / revisions) — its own 2-3 sub-PRs; verify PO existence before attempting change orders.
4. **RFQ-4** comms timeline — only if needed.

## Migrations (in order)

`migrate-rfq-quote-source.sql` → `migrate-vendor-quote-versions.sql` → `migrate-boq-item-versions.sql` → `migrate-rfq-revisions.sql`. All additive; apply to dev on build, prod on merge (the established flow).

## Risks / decisions to confirm

- **Auto-invite on manual entry?** — can a PM enter a quote for a not-yet-invited vendor, or must they invite first? (Lean: auto-invite.)
- **Evidence storage** — jsonb `attachments` (chosen for v1) vs a dedicated `quote_attachment` table (better querying). Revisit if attachments need per-file metadata/search.
- **PO existence** gates RFQ-3 change orders — verify before planning that sub-PR.
- **Only `active`/current matches** — versioning must not change which quote/RFQ is "current" for comparison/award.

## Deferred (PRD's own Phase 2)

Live email/WhatsApp _integrations_, OCR quote extraction, auto-reminder emails, AI vendor recommendation, automatic comparison.
