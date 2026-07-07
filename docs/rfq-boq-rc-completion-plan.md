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

### PR 1 — Quick wins + BOQ gate widen · effort S

| Item                   | Change                                                                                                                                                                                                                | Files                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| RC sort bug            | `RATE_CONTRACT_SORT_SQL.status` CASE covers only 4 of 8 statuses → NULL sort key. Extend to all 8 in lifecycle order.                                                                                                 | `src/lib/queries/rateContracts.ts:43-48`                                                         |
| RFQ §8 preferred-first | Add `preferred_vendor` to the `matches` CTE SELECT + `ORDER BY v.preferred_vendor DESC, rating DESC…` in both pickers; add to `VendorLite`; "Preferred" chip in the picker.                                           | `queries/rfqs.ts:449-460,477-485`, `types/index.ts` (VendorLite), `RfqIssueDialog.tsx`           |
| RFQ §15 uploadedBy     | In `getQuotesByRfq`, batch-resolve evidence `uploadedBy` ids → names (one `SELECT id,name FROM "user" WHERE id = ANY(...)`, map onto each JSONB evidence row as `uploadedByName`). Surface in the evidence meta line. | `queries/quotes.ts` (quote read), `RfqQuotesSection.tsx:131-171`, `types` (QuoteEvidence + name) |
| RC line-no             | Add `line_no INTEGER` to `rate_contract_item` (migration, backfilled by current order); set on insert; order + display by it.                                                                                         | new `scripts/migrate-rate-contract-line-no.sql`, `rateContracts.ts`, `RateContractItemTable.tsx` |
| BOQ §5 widen           | Admit `client_approved` **and** `ready_for_procurement` in the RFQ eligibility gate + available-count query. Keep `po_status='none'`.                                                                                 | `queries/rfqs.ts:113-127,832-844,961-971`, update gate tests                                     |

Tests: RC sort ordering, preferred-vendor ordering, eligibility now admits client_approved, evidence name resolution.

### PR 2 — RFQ completeness (§11 + §14) · effort M

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

### PR 3 — Rate-Contract completeness · effort M

- **Multi-attachment table** `rate_contract_attachment` (contract_id, url, file_name,
  file_type, uploaded_by, uploaded_at); migrate the single `agreement_url` into it;
  `AttachmentsEditor` on the contract form. Keep `agreement_url` read path for back-compat.
- **History/audit**: extend `logAuditSafe` coverage to RC create / update / item-edit
  (today only transitions are audited).
- Files: `scripts/migrate-rate-contract-attachments.sql`, `queries/rateContracts.ts`,
  RC form UI, `auditConstants.ts`, tests.

### PR 4 — Scope-Change workflow, backend + studio (§21–22) · effort L

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

- **Order:** PR1 → PR4 as written. Small/independent first (1–3), gate widen (1), then the
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
| 1   | Quick wins + BOQ gate               | S      |
| 2   | RFQ §11 mixed/contact + §14 decline | M      |
| 3   | RC multi-attachment + history       | M      |
| 4   | Scope-change backend + studio       | L      |
| 5   | Scope-change client + notifications | M      |
