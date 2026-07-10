# Quote comparison: hoist prior-awards + drop `vq.*` over-fetch

- **Tier / Impact / Effort:** T3 · Med · M
- **Area:** db
- **Files:** `src/lib/queries/quotes.ts:291-317` (getQuoteComparison quoteRes with prior_awards subquery), `src/lib/queries/quotes.ts:112` (getQuotesByRfq header select), `src/lib/queries/quotes.ts:191,204` (getQuoteDetail selects), `src/lib/queries/quotes.ts:239` (getQuoteForVendor select)

## Problem

**(a) Correlated prior-awards subquery, re-run per vendor row.** In `getQuoteComparison` the quote-header select (`quotes.ts:299-315`) carries, for *each* current quote row, a correlated subquery:

```sql
(SELECT COUNT(DISTINCT r.rfq_number)
   FROM rfq r
  WHERE r.org_id = (SELECT org_id FROM rfq WHERE id = $1)
    AND r.status <> 'superseded'
    AND r.rfq_number <> (SELECT rfq_number FROM rfq WHERE id = $1)
    AND (r.awarded_vendor_id = vq.vendor_id
         OR EXISTS (SELECT 1 FROM rfq_item ri
                     WHERE ri.rfq_id = r.id AND ri.awarded_vendor_id = vq.vendor_id)))
```

This is O(V) in vendors quoting the RFQ, and each row **re-evaluates the two scalar subselects** `(SELECT org_id FROM rfq WHERE id=$1)` and `(SELECT rfq_number FROM rfq WHERE id=$1)` — redundant single-row lookups repeated V times. The award partial indexes keep each probe bounded (not pathological), but the per-row correlation and redundant scalar re-selects are pure waste.

**(b) `vq.*` over-fetch.** `getQuoteComparison` (`:299`) and the sibling reads `getQuotesByRfq` (`:112`), `getQuoteDetail` (`:191`, `:204`), `getQuoteForVendor` (`:239`) all `SELECT vq.*`, which pulls the `attachments` JSONB (evidence arrays — potentially several KB per quote). The comparison view (`vendorColumns` at `:433-453`) never renders `attachments`; it maps a fixed set of scalar columns. Those bytes are fetched and discarded.

## Fix

**(a) Compute prior-awards once via CTEs.** Replace the per-row correlated subquery with:

- A one-row CTE hoisting the RFQ's own identity: `WITH this_rfq AS (SELECT org_id, rfq_number FROM rfq WHERE id = $1)`.
- A `prior_awards` CTE that unions single-award wins (`rfq.awarded_vendor_id`) and split-award wins (`rfq_item.awarded_vendor_id`) across the org, excluding superseded RFQs and this RFQ's own `rfq_number`, then `GROUP BY vendor_id` → one count per vendor. Example shape:

```sql
WITH this_rfq AS (SELECT org_id, rfq_number FROM rfq WHERE id = $1),
prior_awards AS (
  SELECT vendor_id, COUNT(DISTINCT rfq_number) AS cnt
  FROM (
    SELECT r.rfq_number, r.awarded_vendor_id AS vendor_id
      FROM rfq r, this_rfq t
     WHERE r.org_id = t.org_id AND r.status <> 'superseded'
       AND r.rfq_number <> t.rfq_number AND r.awarded_vendor_id IS NOT NULL
    UNION ALL
    SELECT r.rfq_number, ri.awarded_vendor_id AS vendor_id
      FROM rfq r JOIN rfq_item ri ON ri.rfq_id = r.id, this_rfq t
     WHERE r.org_id = t.org_id AND r.status <> 'superseded'
       AND r.rfq_number <> t.rfq_number AND ri.awarded_vendor_id IS NOT NULL
  ) wins
  GROUP BY vendor_id
)
```

Then `LEFT JOIN prior_awards pa ON pa.vendor_id = vq.vendor_id` and expose `COALESCE(pa.cnt, 0) AS prior_awards`. One aggregation over the org's awarded rows instead of V correlated scans; the two scalar subselects collapse into `this_rfq`.

**(b) Enumerate columns instead of `vq.*`.** In `getQuoteComparison`'s header select, replace `vq.*` with the explicit columns the comparison actually consumes (the fields read in `vendorColumns` + `quoteById` map: `id, vendor_id, status, response_source, is_late, valid_until, delivery_period, payment_terms, inclusions, exclusions, currency, submitted_at`) — dropping `attachments`. Do the same trimming for `getQuotesByRfq` (`:112`) if its callers don't render evidence; if they do, leave it. Keep `mapQuoteRow` in sync with whatever column set each caller selects (it currently expects the full row — either add a comparison-specific mapper or verify the trimmed columns still satisfy the mapped shape).

## Verification

- Snapshot `getQuoteComparison` output for a fixture RFQ before/after — `vendor_prior_awards` values and all vendor columns must be identical. Add/extend a test asserting prior-awards counts for single-award and split-award history.
- `EXPLAIN (ANALYZE)` shows one hash aggregate for `prior_awards` instead of N correlated SubPlans; the two scalar InitPlans appear once.
- Confirm bytes transferred drop (attachments no longer in the comparison result set) — check via `EXPLAIN (ANALYZE, VERBOSE)` output width or row payload.
- Existing quote tests (`src/test/` quote suites) pass unchanged.

## Risks / notes

- `UNION ALL` + outer `COUNT(DISTINCT rfq_number)` preserves the original "distinct logical RFQs won" semantics; a plain `UNION` would also work but `DISTINCT` in the count is what matters.
- Watch `mapQuoteRow` (`quotes.ts:63-91`): it reads many fields. If you trim the comparison select, use a dedicated mapper for that path so a missing column doesn't produce `undefined` in shared code.
- Behaviour-preserving only — no schema change, no new index (existing `awarded_vendor_id` partial indexes still serve the CTE scans).
