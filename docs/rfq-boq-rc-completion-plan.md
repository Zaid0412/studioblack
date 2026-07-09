# RFQ / BOQ / Rate-Contract Completion Plan (pre-PO)

Goal: bring the three procurement modules to genuine spec-completeness **before** the
PO/Invoice milestone. Derived from a code-vs-spec audit against the four requirement
docs (RFQ - NEW, RFQ - detailed REQ NEW, Rate contract, Vendor-catsubservice).

**In scope:** every gap closable without the PO/Change-Order module, plus the pre-PO
half of the §21–22 Scope-Change workflow.

**Explicitly out (needs PO/CO — next milestone):** BOQ F4 hard-block + CO redirect,
Rule-4 versioning, Ordered/Invoiced lifecycle badges, price-ladder PO/invoice stages,
RC "PO-against-contract" execution + min/max consumption, RFQ after-PO change orders,
live WhatsApp/OCR/AI integrations.

> **Note:** the "vendor rating doesn't persist" symptom is **not a code bug** — the
> save path is correct end-to-end (audited). Treat as a stale-build/env artifact;
> re-test on a fresh build. No fix scheduled unless it reproduces clean.

---

## PR sequence

### PR 1 — Quick wins · effort S · **shipped (PR #173)**

| Item                   | Change                                                                                                                                          | Files                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| RC sort bug            | `RATE_CONTRACT_SORT_SQL.status` CASE covered only 4 of 8 statuses → NULL sort key. Extended to all 8 in lifecycle order.                        | `src/lib/queries/rateContracts.ts`                                   |
| RFQ §8 preferred-first | Added `preferred_vendor` to both vendor pickers + `ORDER BY v.preferred_vendor DESC, …`; added to `VendorLite`; "Preferred" chip in the picker. | `queries/rfqs.ts`, `types/index.ts`, `RfqIssueDialog.tsx`            |
| RFQ §15 uploadedBy     | In `getQuotesByRfq`, batch-resolve evidence `uploadedBy` ids → names via the existing `getUsersByIds`; surface in the evidence meta line.       | `queries/quotes.ts`, `RfqQuotesSection.tsx`, `types` (QuoteEvidence) |
| RC line-no             | **No change needed** — the item table already renders a 1-based row index; persisting a `line_no` column would fight the `ON CONFLICT` dedup.   | —                                                                    |

> **BOQ §5 gate — considered, then kept as-is.** We briefly widened RFQ
> eligibility to admit `client_approved` items (spec §5 lists both statuses),
> but that would make `ready_for_procurement` a vestigial gate. Client sign-off
> ≠ the PM's decision to start sourcing, so `ready_for_procurement` **remains the
> required gate** (RFQ-4a). The `RFQ_ELIGIBLE_PHASES` constant (single value,
> `phase = ANY($n)`) was kept as a dedup across the server gate + client picker.

Also applied a /simplify pass: extracted `RFQ_ELIGIBLE_PHASES`, routed the
uploader lookup through `getUsersByIds`.

Tests shipped: RC sort ordering, preferred-vendor ordering, evidence name resolution.

### PR 2 — RFQ completeness (§11 + §14) · effort M · **shipped (§11 PR #174, §14 PR #175)**

- **§11 "Mixed" method + Vendor-Contact snapshot**
  - Add `'mixed'` to the `distribution_method` CHECK (migration ALTER).
  - Add `contact_name TEXT` to `rfq_vendor`; at issue, snapshot the vendor's primary
    `receives_rfq` contact name (subquery in `bulkInsertRfqVendors`). Show it in the
    invited-vendors row.
  - **Mixed semantics (decision embedded):** auto-stamp stays `email`/`portal`; a
    vendor's method is upgraded to `'mixed'` when a §17 communication of a _different_
    channel (whatsapp/manual/phone) is logged against that vendor — ties §11 to the
    existing timeline instead of a new sub-entity. (If you'd rather skip the auto-upgrade,
    `'mixed'` simply becomes a manual override; flag on review.)
  - Files: `scripts/migrate-rfq-distribution-mixed.sql`, `queries/rfqs.ts` (bulk insert,
    vendor list, comm-log hook), `page.tsx` invited-vendors list, labels.
- **§14 first-class decline ("quote none")**
  - Add `'declined'` to `vendor_quote.status`; a dedicated `declineQuote(rfqId, vendorId, reason)`
    mutation + route (not a quote submit — bypasses `items.min(1)`).
  - Portal + studio: a "Decline to quote" action with an optional reason.
  - Comparison + quote list render "Declined" for that vendor.
  - Files: `scripts/migrate-quote-declined-status.sql`, `queries/quotes.ts`, new decline
    route(s), `VendorQuoteSubmitDialog.tsx` / portal page, `RfqQuotesSection.tsx`,
    `QuoteComparisonTable.tsx`, validations, tests.

### PR 3 — Rate-Contract completeness · effort M · **shipped (PR #176)**

- **Multi-attachment `attachments` JSONB** (not a side table — chose JSONB per the §15
  quote-evidence precedent, no cross-contract attachment queries needed). Replaced the
  single `agreement_url` column: migration adds `attachments`, backfills the old URL as
  the first `{url, fileName:'Signed agreement'}`, then **drops** `agreement_url`. Reuses
  the shared `AttachmentsEditor` on the contract form; detail page renders the doc list.
- **History/audit**: extended `logAuditSafe` to RC create / update / items-upserted /
  item-removed (previously only transitions were audited). The update route audits only a
  **real** write — `updateRateContract` returns `changedColumns`, so a no-op / all-ignored
  PATCH logs nothing (and `fields` reports the actual columns, not the raw request keys).
- **/simplify + /review applied**: shared `attachmentRefSchema`/`attachmentRefListField`
  (folded `quoteAttachmentSchema` onto the base), single `attachmentsJson()` serialiser
  (empty list → SQL NULL on both create + update).
- Files: `scripts/migrate-rate-contract-attachments.sql`, `queries/rateContracts.ts`,
  `validations.ts`, `RateContractFormDialog.tsx`, RC detail page, `auditConstants.ts`,
  `types/index.ts`, tests. Migration applied to dev + prod (prod backfilled 1 contract).

### PR 4 — Scope-Change workflow, backend + studio (§21–22) · effort L · **next**

New governed entity reusing existing building blocks (BOQ versioning, RFQ revision,
audit, notifications).

- **Schema** `scope_change`: id, org_id, project_id, boq_item_id, change_reason
  (quantity/specification/scope_add/scope_remove), description, status
  (`requested → under_review → client_approval → approved → implemented`; `rejected`
  terminal), impact (`update_rfq | requote | new_rfq | cancel_item`, defaulted from
  reason), requested_by, reviewed_by, client_decision_by + note, linked
  `boq_item_version_id` / `rfq_id` (resulting revision), timestamps.
- **State machine** in `validations.ts` (mirrors the RC approval-transition pattern).
- **Queries + routes**: create, transition (submit/approve/reject/client-decide),
  implement (executes the impact — triggers a BOQ item edit → version, and/or
  `cloneRfqAsRevision`, linking the result). Org/role gated via `withAuth`.
- **Studio UI**: "Raise scope change" from the BOQ item drawer; a review/approve panel;
  an "Implement" action that routes per `impact`.
- **Reuses:** `boq_item_version` (§20), `cloneRfqAsRevision` (§23), `audit_event` (§25),
  divergence banners (§22) as the impact hints.
- Tests: state-machine transitions, impact routing, gating.

### PR 5 — Scope-Change: client approval + notifications · effort M

- **Client portal**: pending scope-changes list + approve/reject with note (reuse the
  existing project-approval UI patterns and `useUserRole`).
- **Notifications**: on each transition (→ reviewer, → client, → back to PM on decision),
  via the existing notification + `notifications-changed` event.
- **Vendor notification** on the resulting RFQ revision already exists (§24) — just wire
  the implement step to it.
- Tests: client approve/reject path, notification fan-out.

---

## Sequencing & risk

- **Order:** PR1 → PR5 as written. Small/independent first (1–3), then the
  Scope-Change workflow (4–5) on a stable base.
- **Highest risk:** PR2 §14 decline (touches the award/comparison invariants — a declined
  vendor must be excluded from award and shown distinctly) and PR4/5 (spans BOQ + RFQ +
  client portal + notifications).
- **Lowest risk:** PR1, PR3.
- Each PR: `npm run check` + full test suite green, `/review`, grounded test plan, then
  push + `gh pr create`. Migrations applied to dev first, prod on approval.
- Update `docs/PROGRESS.md` (the stale "RFQ Phase 2 not started" line + these modules) as
  part of the final PR.

## Effort roll-up

| PR  | Scope                               | Effort |
| --- | ----------------------------------- | ------ |
| 1   | Quick wins (shipped, PR #173)       | S      |
| 2   | RFQ §11 mixed/contact + §14 decline | M      |
| 3   | RC multi-attachment + history       | M      |
| 4   | Scope-change backend + studio       | L      |
| 5   | Scope-change client + notifications | M      |

---

## PR 6 — Second-audit gap closure · effort L · **shipped (this PR)**

A rigorous re-audit after the scope-change revert surfaced real spec gaps beyond
§21–22. Closed in one combined PR (decisions: derived responded-chip not a new
status; element view as both a full page + dialog panel; taxonomy allows any
tree level — no leaf enforcement; one combined PR).

| Item                                   | Change                                                                                                                                                                                                                                                     | Files                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Taxonomy first-class on BOQ/RFQ        | Added `category_id` to `boq_item` (+ snapshot on `rfq_item`), backfilled from elements. Free-text lines are now classifiable.                                                                                                                              | `migrate-boq-rfq-category.sql`, `queries/boq.ts`, `queries/rfqs.ts`, `types`                                                   |
| Rate matching for free-text items      | `getActiveRatesForBoqItem` takes a `{elementId, categoryId}` target + category-keyed ancestor CTE; `applyRateContractToBoqItem` drops the `no_element` guard → `no_category`; new per-item `getActiveRatesForBoqItemById` + `/boq/items/[id]/rates` route. | `queries/rateContracts.ts`, `queries/helpers.ts`, `boq/items/[id]/rates/route.ts`                                              |
| Vendor suggestion for free-text items  | `getSuggestedVendorsForRfq` LEFT JOINs element + `COALESCE(ri.category_id, bi.category_id, e.category_id)`.                                                                                                                                                | `queries/rfqs.ts`                                                                                                              |
| BOQ create/drawer service-area picker  | Always-visible "Service area" `CategorySelect` on the create sheet (classifies item + reused for the saved element); reclassify picker in the drawer.                                                                                                      | `BoqCreateItemSheet.tsx`, `BoqItemDrawer.tsx`                                                                                  |
| RC detail — 8 hidden fields            | Detail query now selects `project_id`/`tax_*`; page renders contract type, price basis, credit period, delivery terms, renewal date, project, tax.                                                                                                         | `queries/rateContracts.ts`, `rate-contracts/[id]/page.tsx`                                                                     |
| RC activity view                       | `getRateContractHistory` + `/rate-contracts/[id]/history` route + `RateContractActivity` timeline.                                                                                                                                                         | `queries/rateContracts.ts`, `[id]/history/route.ts`, `RateContractActivity.tsx`                                                |
| RC per-item notes                      | `notes` input on the item picker + shown in the item table (column already existed, no input).                                                                                                                                                             | `RateContractItemPicker.tsx`, `RateContractItemTable.tsx`                                                                      |
| Element detail page + rates panel (§8) | New `elements/[id]` detail page + shared `AvailableRatesPanel` reused in the edit dialog; extracted `buildElementMutationPayload`.                                                                                                                         | `elements/[id]/page.tsx`, `AvailableRatesPanel.tsx`, `_lib/elementFormPayload.ts`, `ElementFormDialog.tsx`, `ElementTable.tsx` |
| RFQ §16 mandatory remarks              | `enterQuoteSchema.notes` required (PM manual entry only; vendor portal stays optional).                                                                                                                                                                    | `validations.ts`, `ManualQuoteDialog.tsx`                                                                                      |
| RFQ §9 responded granularity           | Derived `responded_count` on the studio list + "X of Y responded" chip on the list and comparison page (no new status).                                                                                                                                    | `queries/rfqs.ts`, `RfqList.tsx`, `comparison/page.tsx`                                                                        |
| BOQ change-reason cleanup              | Dropped the unreachable `scope_add`/`scope_remove` reasons from the CHECK + enum.                                                                                                                                                                          | `migrate-boq-change-reason-cleanup.sql`, `validations.ts`                                                                      |

> **Not gaps (by design):** side tables replaced by JSONB/columns; taxonomy allows any
> tree level (leaf not enforced — ancestor expansion covers upward matching); §5
> eligibility stays `ready_for_procurement`-only. **Deferred (post-PO):** PO-against-contract,
> min/max consumption, change orders, live email/WhatsApp/OCR/AI. **Reverted:** §21–22 scope-change.
