# RFQ Gap-Closure Plan (PRD §9 / §11 / §17 / §24 + Rate Contract integration)

Closes the remaining gaps between the consolidated RFQ PRD and the shipped
module (RFQ-1 → 3d, 4a). The MVP scope (PRD §28) is otherwise complete. Three
PRs, sequenced small → large.

## Locked decisions

- **Sequencing:** bundle the two small tracks — **PR A** = Package Type +
  minor polish + per-item attachments; **PR B** = Communication Timeline;
  **PR C** = Rate-Contract procurement surface. (3 PRs total.)
- **Communication timeline:** manual entries **and** auto-logged system events
  (one unified timeline).
- **Rate-Contract surface:** shown on the RFQ-create picker **and** as a BOQ
  drawer indicator; **"Use contract"** applies the contract rate (existing
  apply-rate flow) and drops the item from the RFQ selection.
- **Per-item RFQ attachments:** included in **PR A** (not deferred).

## Reusable building blocks (verified)

- `RATE_CONTRACT_TYPES = ['material','labor','mixed']` (validations.ts) — mirror
  for `RFQ_PACKAGE_TYPES`.
- `RFQ_RESPONSE_SOURCES` (portal/email/whatsapp/phone/pdf/excel/manual) — reuse
  as the communication channel enum.
- `getActiveRatesForBoqItem(orgId, elementId, vendorId?)` (rateContracts.ts) —
  already matches active rate contracts to a BOQ item; powers apply-rate and
  will power PR C's batch check.
- Existing apply-rate route (`…/boq/items/[itemId]/apply-rate`) — the "Use
  contract" action for PR C.

---

## PR A — RFQ item & header enhancements

**Package Type (PRD §9)**

- New `RFQ_PACKAGE_TYPES = ['material','labor','mixed']` + `parse` helpers.
- Migration: `rfq.package_type text` + CHECK.
- Schema: `packageType` on `createRfqSchema` + `updateRfqSchema`.
- `createRfqDraft` inserts it; `getRfqDetail` returns it (already `SELECT *`);
  `Rfq.package_type`.
- UI: `Select` on `RfqCreateForm` + `RfqEditDialog`; show on the detail header.

**Proposed Price (PRD §11)**

- Migration: `rfq_item.proposed_price numeric` (nullable).
- Snapshot the BOQ item `sell_price` onto `rfq_item.proposed_price` at RFQ
  creation (createRfqDraft + addRfqItems + revision clone).
- Surface as a reference column in the quote comparison sheet.

**Revision message (PRD §24)**

- When issuing an RFQ with `revision_number > 0`, send a "Revision issued —
  please submit a revised quotation" email variant instead of the standard
  issue email. Locate the issue/notify path and branch on revision number.

**Per-item attachments (PRD §11)** — SHIPPED as JSONB, not a table

- Implemented as an `rfq_item.attachments` JSONB `{url, fileName}[]` column
  (mirroring the vendor-quote evidence pattern) rather than a normalized
  `rfq_item_attachment` table. Chosen for DRY (reuses `quoteAttachmentSchema`,
  the `QuoteAttachment` type, and the shared `AttachmentsEditor`); reference
  docs are low-volume.
- Managed on the RFQ **detail** page (studio) via a dialog; vendors see the
  files read-only on both the studio + vendor item tables.
- Known trade-offs of the JSONB choice (accepted): no per-file audit
  (uploaded_by/created_at/size), whole-array replace on save has a lost-update
  window if two PMs edit the same line concurrently, and removing a file
  orphans the storage object (no delete hook). Revisit with a normalized table
  only if per-file audit or storage GC becomes a requirement.

**Migrations:** `rfq.package_type`, `rfq_item.proposed_price`,
`rfq_item.attachments` (JSONB).

---

## PR B — Communication Timeline (PRD §17)

- Migration: `rfq_communication` (id, rfq_id FK, org_id, vendor_id nullable FK,
  channel, summary, remarks, created_by, created_at). Channel reuses
  `RFQ_RESPONSE_SOURCES`.
- Backend: `insertRfqCommunication` / `listRfqCommunications`;
  `POST`/`GET …/rfqs/[rfqId]/communications`; hook + types.
- **Manual:** "Log communication" dialog on the RFQ detail (channel, optional
  vendor, remarks). PM/architect.
- **Auto-log:** write a comms row on RFQ sent (issue) / revised / vendor
  invited / quote received, so the section is one unified timeline.
- UI: a Communication log section on the RFQ detail. en/tr, tests.

**Migration:** `rfq_communication` table.

---

## PR C — Rate Contract → procurement decision surface

- Backend: batch "which of these selected BOQ items have an active matching
  rate contract" (reuse `getActiveRatesForBoqItem` per item) → endpoint.
- **RFQ create:** banner + per-item hint "Active Rate Contract available
  (vendor · rate)". **Use contract** applies the rate (existing apply-rate) and
  drops the item from the RFQ selection.
- **BOQ drawer:** "active rate contract available" indicator.
- en/tr, tests.

**Migration:** none.

---

## Process (per PR)

`/simplify` + `/review` + test plan → push + `gh pr create`. Migrations apply
to dev on build, prod on merge.

## Explicitly out of scope (Phase 2 per the PRD)

Email/WhatsApp integration, OCR quote extraction, auto-reminder emails, AI
vendor recommendation, automatic quote comparison.

## Doc note

PRD §5 says "Client Approved **or** Ready for Procurement" may enter
procurement, but the RFQ-NEW doc says "**only** Ready for Procurement." The
shipped gate (RFQ-4a) enforces the stricter **only `ready_for_procurement`**,
per the explicit product request — intentional, not a gap.
