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

## 3. RFQ-3 — Scope change → RFQ revisions (LARGE — 3 sub-PRs: 3a → 3b → 3c)

**Why:** `RFQ - NEW.docx` 2nd half — scope changes happen on every project. Never overwrite BOQ qty/spec; version it, and when a change hits an in-flight RFQ raise a revision instead of editing an issued RFQ in place.

**Scoping (verified 2026-07-02):**

- **Change Orders (post-PO) are OUT of scope.** No `po`/`purchase_order` table exists — procurement execution isn't built, so `boq_item.po_status` never advances past `quoted`. Revisit COs only once a PO layer ships.
- **Do NOT build a new scope-change approval state machine.** The `boq_item.phase` lifecycle (F13: draft → internal_review → internally_approved → sent_to_client → client_reviewing → client_approved, plus the two `*_changes_requested` states) already models requested → internal review → client approval. It even auto-flips a `client_approved` item back to `sent_to_client` when a `REAPPROVAL_FIELD` (qty/spec/cost/dims) is edited. RFQ-3 **reuses** this; it does not duplicate it as a separate `scope_change` entity mirroring the rate-contract SM.

The genuine gaps: (1) qty/spec edits overwrite the row — prior values are lost; (2) issued RFQs are locked with no revision path; (3) a BOQ change to an item already in an RFQ is neither detected nor routed.

---

### 3a — BOQ-item change versioning ⬅ START HERE (self-contained, additive, low risk)

Immutable history of qty/spec/cost changes on a BOQ item, with a reason.

**Schema** (`migrate-boq-item-versions.sql`) — **snapshot table, NOT row-versioning.** `boq_item` is the central procurement entity (referenced by `rfq_item.boq_item_id`, rate contracts, BOQ totals, the BOQ tab). Row-versioning it à la RFQ-2's `is_current` pattern would force an `is_current` filter on every boq_item read app-wide — a huge regression surface. A side snapshot table keeps the live row + all FKs stable and mirrors the existing `boq.snapshot` precedent.

```
boq_item_version:
  id             UUID PK
  boq_item_id    UUID FK → boq_item (ON DELETE CASCADE)
  version_number INT            -- 1-based, per item
  change_reason  TEXT           -- CHECK: quantity | specification | scope_add | scope_remove | other
  change_note    TEXT NULL      -- optional free text
  changed_by     TEXT FK → user
  changed_at     TIMESTAMPTZ
  snapshot       JSONB          -- immutable pre-edit state of the row
UNIQUE (boq_item_id, version_number)
INDEX  (boq_item_id, version_number DESC)
```

**Backend** (`boq.ts`)

- In `updateBoqItem`, inside the existing tx: if any `REAPPROVAL_FIELD` changed, INSERT a `boq_item_version` snapshot of the **pre-edit** row with `version_number = COALESCE(max,0)+1` and the supplied `change_reason`/`change_note`. Non-material edits (notes, sort_order, flags) do NOT version.
- `getBoqItemVersions(itemId)` → history newest-first.

**Validation** (`validations.ts`): extend `updateBoqItemSchema` with optional `changeReason` (enum `BOQ_ITEM_CHANGE_REASONS`) + `changeNote` (max 2000). Meaningful only when a material field is in the patch; default `change_reason='other'` if omitted.

**API:** existing `PATCH /api/projects/[id]/boq/items/[itemId]` carries the new fields; new `GET …/items/[itemId]/versions`.

**UI:** version history in the BOQ item drawer's existing **Activity tab** (each version: reason badge + note + who/when + a qty/spec before→after diff). When editing a material field, a small optional "reason for change" input (Select + note) in the drawer / editable-cell save path.

**Audit:** `boq.item.versioned` (metadata: version_number, change_reason).

**Tests:** snapshot-on-material-edit, no-snapshot-on-trivial-edit, versions query/route, schema (material edit → reason accepted/defaulted).

**Migration:** yes (new table). **Effort:** Med.

---

### 3b — RFQ revisions (clone + supersede)

When scope changes after issue, raise a revision instead of editing a locked RFQ
(exactly the case `addRfqItems` already refuses: "the right move there is to
create a new RFQ").

**Decisions (locked):**

- **Old RFQ marker = status `superseded`**, NOT an `is_current` flag. Every existing
  mutation guard (issue/invite/award/cancel/addItems + `QUOTE_SUBMITTABLE/AWARDABLE`
  status sets) already whitelists specific statuses, so `superseded` auto-locks the old
  RFQ — fail-closed, no new guards. Award facts on `rfq_item` persist; only the status
  label changes.
- **Revision reuses the base number** as `RFQ-2026-0042 · Rev 1` — swap the
  `UNIQUE (org_id, rfq_number)` constraint for `UNIQUE (org_id, rfq_number, revision_number)`.
- **Vendors are copied** from the old RFQ onto the revision by default (PM can adjust).

**Schema** (`migrate-rfq-revisions.sql`): `rfq ADD revision_number INT NOT NULL DEFAULT 0,
ADD supersedes_rfq_id UUID REFERENCES rfq(id) ON DELETE SET NULL`; drop the old
`(org_id, rfq_number)` unique, add `(org_id, rfq_number, revision_number)`.
`RFQ_STATUSES += 'superseded'`.

**Backend** (`rfqs.ts`): `cloneRfqAsRevision(rfqId, reason, userId)` — mirrors the
`cancelRfq` FOR-UPDATE + guard pattern: lock old RFQ, require status ∈ {issued,
quotes_received, under_review, awarded}, insert a new **draft** rfq (same `rfq_number`,
`revision_number = old+1`, `supersedes_rfq_id = old.id`, copy title/scope/terms/deadline),
copy `rfq_item` rows with `awarded_vendor_id`/`awarded_quote_item_id` reset, copy
`rfq_vendor` invites, set old → `superseded`, audit `rfq.revised`. Superseding does NOT
revert `boq_item.po_status` (the revision carries the items forward); `cancelRfq`'s
"live RFQ" exclusion gains `'superseded'`. `getRfqsByProject` excludes `superseded` by
default; `getRfqDetail` surfaces the chain (supersedes number + superseded-by number).

**API:** `POST …/rfqs/[rfqId]/revise` (pm/architect), body `{ reason }`.
**UI:** "Create revision" action on an issued/awarded RFQ → reason dialog → navigate to the
new draft; "Rev N · supersedes RFQ-…" banner on the revision + "Superseded by RFQ-… Rev N"
on the old; `RfqStatusBadge` + i18n gain `superseded`; list hides superseded; RFQ number
renders `· Rev N` when `revision_number > 0`.
**Audit:** `rfq.revised` (metadata: supersedes_rfq_id, revision_number).
**Tests:** clone resets awards + copies vendors, old marked superseded, rev increments,
refuses draft/cancelled/superseded, po_status untouched; revise route; schema; list excludes
superseded.
**Depends on:** 3a. **Migration:** yes. **Effort:** Med-High.

---

### 3c — Scope-change impact routing (PRD §22 matrix) ⬅ NEXT

Make the PM aware when a BOQ change affects an **in-flight** RFQ (issued /
quotes_received / under_review) and give them the §22 reconciliation paths. 3a's
`change_reason` is the routing signal; 3b (revisions) is the requote path.

**Decisions (locked):**

- **Detection = read-time divergence, NOT a persisted flag.** The RFQ _reads_ its own
  divergence rather than the BOQ edit path _pushing_ flags — zero coupling to
  `updateBoqItem`/`deleteBoqItem`, no schema, always accurate. (Rejected a
  `rfq_item.needs_requote` column: cheaper reads but couples the BOQ path + goes stale.)
- **Sync = quantity only.** Per §22, a spec change is "requote required" — so only qty
  divergence gets the in-place "Sync from BOQ"; spec divergence routes to a revision.
- **`cloneRfqAsRevision` refreshes items from `boq_item`** (currently copies the stale
  `rfq_item` snapshot) so a revision reflects the current BOQ — benefits all revisions.

**Detection** (`getRfqDetail`, in-flight statuses only): JOIN each `rfq_item` → its live
`boq_item`, compute per-field diffs (quantity / description / unit — snapshot vs current).
Return `{ diverged, diffs: [{field, from, to}] }` per item + a count. No write-path change.

**Backend:** `syncRfqItemsFromBoq(rfqId)` — copies current `boq_item.quantity` into the
diverged items (in-flight only), audit `rfq.synced_from_boq`. Modify `cloneRfqAsRevision`
to source item fields from `boq_item`.

**UI:** RFQ-detail banner when `diverged_count > 0` — "N item(s) changed in the BOQ since
this RFQ was issued" with each diff (`Qty 10 → 15`, `Spec …`); **quantity changes → "Sync
from BOQ"**; **spec changes → "Create revision"** (3b).

**Tests:** divergence read (qty/spec/none), sync updates only qty on in-flight RFQs,
clone-refreshes-from-BOQ.

**Approval:** reuses the existing `boq_item.phase` re-approval loop — no new SM.
**Depends on:** 3a + 3b. **Migration:** none. **Effort:** Med.

---

### 3d — Scope removal / addition impact (FUTURE PR)

The other half of the §22 matrix, deferred out of 3c:

- **Removed item** — `rfq_item.boq_item_id` is `ON DELETE RESTRICT`, so a BOQ item in an
  RFQ currently **can't be deleted**. This PR would: relax to `ON DELETE` handling (or
  intercept `deleteBoqItem`), and when a BOQ item on an in-flight RFQ is removed, **cancel
  the corresponding `rfq_item`** (and surface it on the RFQ). Migration: FK change.
- **New item** — a newly-added BOQ item isn't in any RFQ. Surface "N BOQ items ready for
  procurement not yet in an RFQ" and let the PM add them to a **new RFQ or a revision**.
  Overlaps with RFQ-4's BOQ-eligibility gate. Migration: none.

**Effort:** Med. **Do after:** 3c.

---

## 4. RFQ-4 — Smaller items (fold in opportunistically)

### 4a — "Ready for Procurement" gate (BOQ → RFQ eligibility) ⬅ own PR

**Feedback (2026-07-03):** "Once client-approved, the PM changes a BOQ item to _Ready for
Procurement_; only then can it be added to an RFQ. PM must approve this for RFQ, then Arch
or PM can initiate the RFQ."

**Current state (verified):** the phase lifecycle ends at `client_approved` — no
procurement-ready state. There is **no eligibility gate**: `createRfqDraft`/`addRfqItems`
only validate item ownership; items enter an RFQ gated solely by `po_status='none'`, and
the create picker doesn't filter by approval. RFQ creation already allows **PM + architect**
(so "Arch or PM can initiate" already holds).

**Plan:**

- **New phase `ready_for_procurement`** (after `client_approved`). The transition
  `client_approved → ready_for_procurement` is **PM-only** — this _is_ the "PM approves for
  RFQ" step. Editing a material field on a ready item flips it back for re-approval
  (reuse the existing `client_approved → sent_to_client` auto-flip). Touches
  `BOQ_ITEM_PHASES`, `BOQ_ITEM_PHASE_TRANSITIONS`, `canFireBoqPhaseTransition` (PM-only),
  phase badge/label, i18n, and the bulk-lifecycle picker.
- **Gate:** `createRfqDraft` + `addRfqItems` require every BOQ item be
  `phase='ready_for_procurement'` **and** `po_status='none'` — reject otherwise. The RFQ
  create picker shows only eligible items + an empty-state hint.
- **UI:** "Mark ready for procurement" action on `client_approved` items (PM only) —
  item drawer + bulk lifecycle.

**Migration:** yes — extend `boq_item_phase_check` (the CHECK currently restricts `phase` to
the 8 values; adding one without this fails, like the `rfq_status_check` gotcha in 3b).
**Effort:** Med.

**Decisions to confirm:** (1) model as a new `phase` value [rec] vs a separate
`procurement_status` field; (2) edit of a ready item flips to `sent_to_client` [rec] vs
`client_approved`; (3) include bulk "mark ready" [rec: yes].

### 4b — Other smaller items

- **RFQ package name/type** — `rfq` `ADD package_type TEXT` (material/labor/equipment/subcontract/other; multi via array or a join). `title` already serves as package name. Overlaps with RFQ-1's distribution work — do together. Migration: additive.
- **Dedicated `rfq_communications` timeline** — table (id, rfq_id, vendor_id, date, user, action, channel, remarks) + a timeline UI on the RFQ. Today derived from `audit_event`. Lower priority — only if the audit-derived timeline proves insufficient. Migration: new table.

---

## Sequencing

1. **RFQ-1** ✅ shipped (#154) — manual/multi-channel entry + evidence.
2. **RFQ-2** ✅ shipped (#155) — quote versioning.
3. **RFQ-3** (scope change / revisions): **3a** ✅ (#156) → **3b** ✅ (#157) → **3c** ◀ next → **3d** (future: scope removal/addition). Change Orders out of scope (no PO layer).
4. **RFQ-4a** "Ready for Procurement" gate (BOQ→RFQ eligibility) — own PR, from the 2026-07-03 feedback. Then **4b** package_type / comms timeline — only if needed.

## Migrations (in order)

Shipped: `migrate-rfq-quote-source.sql` (RFQ-1) → `migrate-rfq-quote-versions.sql` (RFQ-2). Next: `migrate-boq-item-versions.sql` (3a) → `migrate-rfq-revisions.sql` (3b). All additive; apply to dev on build, prod on merge (the established flow).

## Risks / decisions to confirm

- **RFQ-3 Change Orders** — CONFIRMED out of scope: no `po`/`purchase_order` table exists, so there is no post-PO stage to raise COs against. Revisit only after a PO/procurement-execution layer ships.
- **RFQ-3 approval** — CONFIRMED: reuse the existing `boq_item.phase` client re-approval loop; do NOT build a separate scope-change state machine.
- **boq_item versioning shape** — CONFIRMED: side snapshot table (`boq_item_version`), not row-versioning, to avoid an app-wide `is_current` filter on the central procurement entity.
- **Only `active`/current matches** — versioning must not change which quote/RFQ is "current" for comparison/award. (RFQ revisions in 3b filter `is_current`.)
- ~~Auto-invite on manual entry~~ / ~~Evidence storage~~ — resolved during RFQ-1.

## Deferred (PRD's own Phase 2)

Live email/WhatsApp _integrations_, OCR quote extraction, auto-reminder emails, AI vendor recommendation, automatic comparison.
