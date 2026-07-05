# RFQ Gap-Closure Phase 2 — Implementation Plan

Closes PRD gaps #1 (§14 partial bidding), #2 (§15 evidence), #4 (§11 distribution),
#5 (§19 comparison criteria). Delivered as 3 sequential PRs (D → E → F).

Follow-on to the shipped gap-closure PRs A–C (merged: #162, #163, #164, #165).

---

## PR D — Partial per-item bidding (§14) + comparison criteria (§19)

**Why grouped:** both rework `getQuoteComparison` + `QuoteComparisonTable`. One touch, DRY.

### Problem
`submitOrUpdateQuote` rejects any quote not covering *every* RFQ item
(`missing_items`, quotes.ts:644). PRD §14 / detailed §7: "a vendor may quote
all / some / none." The comparison **read** side already tolerates subset bids
(absent lines render blank) — the block is the submit invariant + the UI forcing
all prices.

### Design decision (no over-modeling)
PRD §14 lists a per-item status enum (Not Started/Partial/Submitted/Rejected/
Withdrawn). **Not implementing that enum** — it's derivable and the quote-level
status already carries submitted/rejected/expired. Model "no bid" as simply *no
`vendor_quote_item` row* for that rfq_item. Satisfies "some/none" without a new
enum. (Flag: override if you want the literal enum.)

### Backend
| File | Change |
|---|---|
| `validations.ts` | `submitQuoteSchema.items` stays `.min(1)` (≥1 line; full decline is a separate future action) |
| `queries/quotes.ts` `submitOrUpdateQuote` | Remove the `inputIds.size !== rfqItemIds.size → missing_items` branch (line ~644). Keep duplicate + unknown-item checks. Subset insert already works |
| `queries/quotes.ts` `awardRfqSingle` | **Guard:** single-award requires the winning quote to cover all items → new reason `incomplete_quote`; else the item is left unpriced. Split-award unaffected (already per-item + full-coverage) |
| award route | map `incomplete_quote` → 409 |

### Comparison criteria (§19) — same PR
| File | Change |
|---|---|
| `types/index.ts` `QuoteComparisonVendorColumn` | add `vendor_rating: number \| null`, `vendor_prior_awards: number` |
| `queries/quotes.ts` `getQuoteComparison` vendor query | join `vendor.rating`; subquery = count of distinct prior RFQs where this vendor won (`rfq.awarded_vendor_id` + split `rfq_item.awarded_vendor_id`). "Previous Projects" is **derived**, not a new manual field |
| `QuoteComparisonTable.tsx` | add Rating + Prior-awards rows; add "X/N items quoted" per vendor column |

### Frontend
- `ManualQuoteDialog.tsx` + vendor-portal `VendorQuoteSubmitDialog`: blank price =
  no bid. `canSubmit` = **≥1** filled (not all). Send only filled lines. Blank row
  shows "Not quoting" hint.

### Tests
partial submit accepted · subset comparison renders · single-award blocked on
partial quote · split still works · rating/prior-award columns present.

### i18n
`X/N items`, `Not quoting`, `Rating`, `Prior awards` (en + tr).

**Effort: M/L · Highest regression risk (changes an invariant award + comparison rely on).**

---

## PR E — Quote evidence management (§15)

### Problem
`QuoteAttachment = {url, fileName}` (types 1304, schema 1635). PRD §15 wants File
Name, File Type, Uploaded By, Uploaded Date, Source, Notes.

### Approach — enrich JSONB, not a new table
No cross-quote evidence queries needed → enrich the existing JSONB shape + reuse
`AttachmentsEditor` and current storage. Server-stamps the trust-sensitive fields.

| File | Change |
|---|---|
| `types/index.ts` `QuoteAttachment` | add `fileType?`, `uploadedBy`, `uploadedAt`, `source`, `notes?` |
| `validations.ts` `quoteAttachmentSchema` | client supplies only `url`, `fileName`, `notes?`, `fileType?` (from extension). **Reject client-supplied uploadedBy/uploadedAt/source** |
| `enter` quote route + portal submit route | server stamps `uploadedBy=user.id`, `uploadedAt=now`, `source=quote.response_source` at save |
| `AttachmentsEditor` (or thin wrapper) | optional per-file Notes; display type icon + uploader/date read-only |

**Alternative (flagged, not recommended):** first-class `quote_attachment` table —
only if you want an evidence library queryable across quotes.

### Tests
schema accepts enriched shape · server stamps uploader/date/source · rejects
client-supplied uploader.

**Effort: M · Low risk (storage/versioning infra already exists).**

---

## PR F — RFQ distribution tracking (§11)

### Problem
Issue = email + portal only. No per-vendor distribution method; sent-date/sent-by
not surfaced. **Heavy overlap** with the §17 communication timeline (already logs
WhatsApp/manual contacts per vendor).

### Approach — minimal, lean on existing data + timeline
`rfq_vendor` already stores `invited_at` (sent date) + `invited_by` (sent by).

| File | Change |
|---|---|
| migration `migrate-rfq-distribution.sql` | `rfq_vendor.distribution_method VARCHAR default 'email'` (portal/email/whatsapp/manual/mixed) + optional `contact_name` snapshot |
| `issue` route / `issueRfq` | stamp method (`email`; `mixed` if portal too) |
| RFQ vendor list / detail | surface existing `invited_at` / `invited_by` / method / contact |

Rely on the §17 timeline for post-issue WhatsApp/manual delivery records rather
than duplicating a distribution sub-entity. (Flag: a full distribution entity
would overlap the timeline — not worth it.)

### Tests
issue stamps method · vendor list shows sent metadata.

**Effort: S · Scope-creep risk (resist rebuilding the timeline).**

---

## Sequencing & dependencies
- **D → E → F.** D first: biggest, reworks the core comparison surface.
- D and #5 share the comparison query/table → bundled (avoids two touches).
- E and F are independent of D and of each other.
- Each ships via the existing cadence: `/simplify` → `/review` → test plan →
  push + `gh pr create`.

## Out of scope (deliberately)
- #3 Scope-change workflow — PRD's own author says BOQ-version + RFQ-revision is
  the right model, which is already built. Close as covered-by-design.
- Per-item status enum (§14) — derivable; not adding.
- Full vendor decline ("quote none") as a first-class action — note for later.
- Multi-currency comparison normalization — pre-existing deferral.
