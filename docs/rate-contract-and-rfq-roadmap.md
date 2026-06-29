# Rate Contract follow-ups (PR A/B/C) + RFQ gaps — roadmap

Living plan for the remaining Rate Contract work and the RFQ-module gaps surfaced
by the latest docs. Updated 2026-06-29.

Source docs reconciled:
- `Rate contract.docx` — rate-contract spec
- `Vendor-catsubservice.docx` — shared-taxonomy doc (already fully implemented: #146/#147/#148)
- `RFQ - NEW.docx` + `RFQ - detailed REQ NEW.docx` — RFQ & Vendor Quotation PRD

---

## 0. Snapshot

| PR | What | State |
|----|------|-------|
| #146 | Shared taxonomy seed (14/51/89, coded) | merged |
| #147 | Vendors map to service areas; retire free-text | merged |
| #148 | Manage categories from /vendors | merged |
| #149 | Rate-contract items by service area + BOQ apply | merged |
| #150 | **PR A** — contract type, commercial terms, richer item fields | **open** (was stacked on #149; retarget to main) |
| —   | **PR B** — vendor-profile Rate Contracts tab | not started |
| —   | **PR C** — status workflow + approval | not started |
| —   | RFQ gaps (manual entry / versioning / revisions) | not started |

### Prod migration state (verified on prod 2026-06-29)
- ✅ `migrate-rate-contract-service-area.sql` (#149) — applied to prod.
- ⏳ `migrate-rate-contract-fields.sql` (#150 / PR A) — run when #150 merges (additive, safe).
- ⚠️ `migrate-vendor-drop-service-areas.sql` (#147) — **NOT run on prod**; legacy `vendor.service_areas` column still present (harmless; optional cleanup, destructive).

---

## 1. PR A — field breadth  ✅ DONE (#150)

Additive migration `scripts/migrate-rate-contract-fields.sql` (no backfill).

**Header (`rate_contract`):** `contract_type` (material/labor/equipment/subcontract/mixed),
`price_basis` (supply / supply_install), `credit_period_days`, `delivery_terms`, `renewal_date`.
**Items (`rate_contract_item`):** `description`, `min_qty`/`max_qty` (+ `max>=min` guard, DB CHECK + Zod),
`lead_time_days`, `valid_until`.

Wired end-to-end: types, Zod (+tests), queries (create/update/insert/select), contract form
(`LabeledSelect` extracted), item picker (collapsible "optional detail" with grid-rows animation),
item table (meta line).

**Deliberately skipped:** per-item currency (conflicts with single-currency model), per-item tax %,
`rate_contract_attachments`/`rate_contract_history` tables (single `agreement_url` + audit log cover it),
optional-advanced (region/branch/project-type/priority/escalation/discount).

---

## 2. PR B — vendor-profile "Rate Contracts" tab  ⬜ TODO

**Why (doc):** Rate Contract doc §"Vendor Screen" wants vendor tabs incl. **Rate Contracts**.
Discoverability — see a vendor's contracts from their profile.

**Effort:** Low-Med. Reuses existing list.

**Approach**
- `VendorDrawer.tsx` already has a `Tabs` (overview/contacts/trades/kyc/bank) — add a
  `rate-contracts` `TabsTrigger` + `TabsContent` (PM/architect; flag-gate on `rateContracts`).
- The list API already filters by vendor: `rateContracts.list({ vendorId, ... })`
  (`src/lib/api/rateContracts.ts` builds `?vendorId=`). Lazy-fetch on tab activation
  (mirror the KYC/bank lazy pattern).
- Render a compact list: contract no, name, status badge, dates, item_count → row links to
  `/elements/rate-contracts/[id]`. Reuse `RateContractStatusBadge`.
- Empty state + a "New rate contract" affordance pre-filled with this vendor (optional).

**Files**
- `src/app/(dashboard)/vendors/_components/VendorDrawer.tsx` (+ tab)
- new `VendorRateContractsTab.tsx` (sibling of `VendorKycTab.tsx`)
- i18n: `vendors.tabRateContracts` (+ tr)
- test: none new strictly required (reuses tested list API); add a hook/render test if cheap.

**No migration.**

---

## 3. PR C — status workflow + approval  ⬜ TODO

**Why (doc):** Rate Contract doc wants 8 statuses + an approval step
(Created By / Approved By / Approved Date), `rate_contract_approvals`.

**Current:** 4 statuses (`draft/active/expired/cancelled`); `created_by` only;
`activateRateContract` is draft→active (no review/approval gate).

**Target statuses (doc):** Draft → Under Review → Approved → Active → Expired → Suspended → Closed → Cancelled.
Pragmatic transition graph:
- draft → under_review (submit) → approved (approve) → active (activate; needs ≥1 item)
- approved → draft (request changes)
- active → suspended ↔ active; active → closed; active → expired (auto)
- any non-terminal → cancelled

**Effort:** Med-High. Status machine + UI + permissions + migration.

**Schema (`migrate-rate-contract-status-workflow.sql`)**
- Expand `rate_contract.status` CHECK to the 8 values (existing rows stay `draft/active/expired/cancelled`).
- Add `approved_by TEXT REFERENCES "user"(id)`, `approved_at TIMESTAMPTZ`, `submitted_at TIMESTAMPTZ`.
  (Skip a separate `rate_contract_approvals` table for v1 — single approver columns + audit log suffice;
  add the table only if multi-step approval is needed later.)

**Backend**
- `src/lib/validations.ts`: `RATE_CONTRACT_STATUSES` → 8; a `RATE_CONTRACT_TRANSITIONS` map; an
  `updateRateContractStatusSchema` (action-based: submit/approve/request_changes/activate/suspend/resume/close/cancel).
- `src/lib/queries/rateContracts.ts`: replace ad-hoc `activateRateContract` with a
  `transitionRateContract(orgId, id, action, userId)` enforcing the graph + setting approved_by/at;
  update the post-active edit allow-list; `getActiveRatesForBoqItem`/matchers already filter `status='active'`
  (no change — keep "active" as the only matchable state).
- API: replace/extend the `activate` route with a `status` (action) route; add review/approve routes.
- Permissions: who can approve (PM/owner vs architect) — read `src/lib/permissions.ts`; doc implies a
  Director/PM approves. Gate approve on PM/owner.

**UI**
- `RateContractStatusBadge` → add the 4 new statuses + colors.
- Detail page: replace the single "Activate" button with contextual actions (Submit for review / Approve /
  Request changes / Activate / Suspend / Resume / Close / Cancel) driven by the transition map + role.
- Show approver + approved date in the header.

**Tests:** transition guards (illegal transitions rejected), approve sets approver, role gating, status-route 400/403.

---

## 4. RFQ module — gaps vs the new PRD  ⬜ TODO (separate module)

**Consistency check:** the RFQ docs do **not** contradict anything built. Same taxonomy +
`vendor_trade` service-area matching, one-RFQ→many-items→many-vendors, **split award per BOQ item**,
BOQ-centric, and the doc's "check rate contract before RFQ" = the #149 apply flow. New work is **additive**.
One nuance: the docs favor **immutable versioning** (quotes/RFQ/BOQ never overwritten); our current code
**edits in place + audit-logs**. Building the versioning features tightens that behavior; it doesn't reverse a decision.

### Already built (F9/F10) — do NOT rebuild
`rfq`/`rfq_item`/`rfq_vendor`/`vendor_quote`/`vendor_quote_item`; vendor suggestion by service area;
quote comparison sheet; **split award** (per-item `awarded_vendor_id`/`awarded_quote_item_id`);
vendor portal submit/revise; RFQ + quote audit trail; statuses draft/issued/quotes_received/under_review/awarded/cancelled.

### Gaps (ranked by value)
**RFQ-1 — Manual / multi-channel quote entry + evidence**  *(highest value)*
- Doc §11–16, 28: most vendors don't use the portal (email/WhatsApp/phone/PDF/Excel).
- Add `vendor_quote.response_source` enum (portal/email/whatsapp/phone/pdf/excel/manual) + `received_date` + `updated_by`.
- PM-side "Enter quote on behalf of vendor" dialog (rates per item) — mandatory response_source/updated_by/received_date.
- Evidence: surface the existing `vendor_quote.attachments` JSONB in the UI (upload the emailed PDF/Excel/screenshot)
  via the existing attachment/upload infra.
- `rfq_vendor`: add `distribution_method` + `sent_date`/`sent_by`.

**RFQ-2 — Quote versioning**
- Doc §18: keep a vendor's quote history (`vendor_quote_versions` or a `supersedes`/`version` column);
  previous versions read-only. Today a resubmission overwrites. Change `submitOrUpdateQuote` to snapshot
  the prior version instead of deleting line items.

**RFQ-3 — Scope change → RFQ revisions (Phase 2, larger)**
- Doc "RFQ - NEW" 2nd half: `boq_item_versions` (immutable BOQ qty/spec revisions), `rfq_revisions`
  (`RFQ-001 Rev-1`), change-order handling after PO, procurement-impact rules
  (qty→reuse rate, spec→re-RFQ, new item→new RFQ/revision, deleted→cancel item), scope-change approval workflow.
- Big; sequence after RFQ-1/2.

**Smaller RFQ items**
- Explicit BOQ **eligibility gate** (only client-approved/ready items enter an RFQ) — today implicit via `po_status`.
- RFQ "package name/type" fields (today `title` only).
- Dedicated `rfq_communications` timeline (today derived from the shared audit log).

**Doc's Phase 2 (defer):** email/WhatsApp *integration*, OCR extraction, auto-reminders, AI vendor reco,
auto comparison, rate-contract↔RFQ integration (the apply path already covers the BOQ side).

---

## 5. Suggested sequence
1. Merge #150 → run `migrate-rate-contract-fields.sql` on prod.
2. **PR B** (vendor tab) — quick win.
3. **PR C** (status/approval) — its own PR.
4. (decision) optionally run the #147 `vendor.service_areas` drop on prod.
5. **RFQ-1** (manual/multi-channel entry + evidence) — highest RFQ value.
6. **RFQ-2** (quote versioning), then **RFQ-3** (scope change / revisions).

## 6. Cleanup owed on dev
Seeded test data on dev (for manual testing): element `FIN-001` recategorized to Base Cabinets;
"The Leafy Haven" contract's seeded `KIT-CAB-BASE` $500 rate; the `PR-A Test` contract if created.
Revert when done testing.
