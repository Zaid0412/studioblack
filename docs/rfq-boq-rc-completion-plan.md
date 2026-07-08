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

### PR 4 — Scope-Change workflow, backend + studio (§21–22) · effort L · **shipped (PR #177)**

New governed `scope_change` entity, modelled on the RC approval pattern.

- **Schema** `scope_change` (migration `scripts/migrate-scope-changes.sql`): id, org_id,
  project_id, boq_item_id, sc_number, change_reason, description, status
  (`requested → under_review → client_approval → approved → implemented`; `rejected`
  terminal), impact (`update_rfq | requote | new_rfq | cancel_item`, defaulted from
  reason), requested_by, reviewed_by/at + review_note, client_decision_by/at + note,
  linked `boq_item_version_id` / `rfq_id`, timestamps. Also widened the `boq_item`
  phase CHECK with a terminal `cancelled`.
- **State machine** `SCOPE_CHANGE_*` in `validations.ts` with **per-action role gating**
  (`roles`): submit/send_to_client/reject_review are studio; approve/reject_client are
  client-only.
- **Queries + routes**: create / update (requested-only) / transition / list / get +
  `implementScopeChange` orchestrator. Impact routing: `cancel_item` → `cancelled` phase
  + `is_excluded`; `update_rfq` → `syncRfqItemsFromBoq`; `requote` → `cloneRfqAsRevision`;
  `new_rfq` → governance-only (in-procurement item fails `createRfqDraft`'s eligibility
  gate). Implement **claims** `approved→implemented` atomically (no held connection across
  the RFQ sub-transactions; reverts the claim on impact error so it's retryable).
- **Studio UI**: raise + review/implement panel in the BOQ item drawer.
- **/simplify + /review applied**: dropped a redundant action map, folded a version
  lookup, reverted a dead `updateBoqItem.versionId`. Migration applied to dev + prod.

> **Scope boundary carried into PR 5:** the transition route is studio-gated
> `["pm","architect"]`, so a scope change reaches `client_approval` and **stops there** —
> `approve`/`reject_client` (client-role) have no client-accessible route yet, so the
> `approved → implement` path is unreachable end-to-end until PR 5 lands.

### PR 5 — Scope-Change: client approval + notifications · effort M · **next**

Unblocks the client half of the §21–22 workflow (the backend transitions already exist).

- **Client route**: a client-accessible transition path (mirror
  `api/projects/[id]/approvals`, `allowedRoles: ["client"]`, `projectAccess: true`) that
  reuses `transitionScopeChange` for `approve` / `reject_client` — the studio route stays
  pm/architect-only.
- **Client UI**: a pending-scope-changes list + approve/reject-with-note (reuse the
  `ReviewSubmitBar` pattern + `useUserRole`), scoped to the client's projects.
- **Notifications**: `createNotificationForClient` on `→ client_approval`; team notify
  (`createNotificationsForTeam` + email) back to the PM on the client decision; add a
  `scope_change` branch to `notificationDestination` for deep-linking. Dispatch
  `notifications-changed` after the client's own action.
- **Optional polish** (from the /review altitude notes): a "PM must raise the RFQ" hint
  keyed off `impact === 'new_rfq' && !rfq_id` on an implemented change.
- Tests: client transition route (approve/reject gating), notification fan-out.

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
