# Dashboard BOQ-review scan needs a phase partial index

- **Tier / Impact / Effort:** T3 · Med · S
- **Area:** db
- **Files:** `src/lib/queries/dashboard.ts:67-90` (getPendingBoqReviews), `src/lib/queries/dashboard.ts:131-205` (getClientPendingReviews), `src/lib/queries/dashboard.ts:225-231` (getDashboardStats boq_review_stats CTE); new migration in `scripts/`; existing pattern `scripts/migrate-attachment-pending-index.sql`, `scripts/migrate-boq-item-phase.sql:85`

## Problem

Three dashboard reads scan `boq_item` filtered by `phase`, then join up to the org via `boq → project`:

- `getDashboardStats` — `boq_review_stats` CTE: `COUNT(DISTINCT bi.boq_id) WHERE p.org_id=$1 AND bi.phase='internal_review'` (fires on every studio dashboard render).
- `getPendingBoqReviews` — same `phase='internal_review'` filter, grouped per BOQ.
- `getClientPendingReviews` — files query + `bi.phase IN ('sent_to_client','client_reviewing')` for the BOQ list and the `total` scalar.

The only phase index is `idx_boq_item_phase (boq_id, phase)` — **boq_id-leading**. An org-wide filter has no `boq_id` to seed from, so the planner can't use it for the phase predicate and walks all of the org's BOQ items (seq scan / broad index scan on the join). This is exactly the case already solved for `attachment` in `scripts/migrate-attachment-pending-index.sql` (partial index on the post-join FK column, keyed by the rare status value).

The pending phases are a small minority of rows, so partial indexes stay tiny and answer the filter directly.

## Fix

Add a new migration `scripts/migrate-boq-item-phase-review-indexes.sql` following the attachment-pending pattern (naming: `idx_boq_item_<purpose>`, `CREATE INDEX IF NOT EXISTS`, header comment + run line):

```sql
-- Partial indexes for the dashboard "pending BOQ review" surfaces.
-- Mirrors scripts/migrate-attachment-pending-index.sql: the org-wide phase
-- filter can't seed from idx_boq_item_phase (boq_id-leading), so index the
-- rare pending phases directly on boq_id (the join key up to project/org).
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-item-phase-review-indexes.sql

CREATE INDEX IF NOT EXISTS idx_boq_item_internal_review
  ON boq_item (boq_id)
  WHERE phase = 'internal_review';

CREATE INDEX IF NOT EXISTS idx_boq_item_client_review
  ON boq_item (boq_id)
  WHERE phase IN ('sent_to_client', 'client_reviewing');
```

Index only on `boq_id` (not `(boq_id, phase)`) — the partial predicate already pins the phase, so the index just needs to enumerate the rare qualifying rows and feed the join to `boq`. No query changes; the planner picks these up automatically once the predicate matches.

## Verification

- `EXPLAIN (ANALYZE, BUFFERS)` on all three queries before/after: expect a Bitmap/Index Scan on the new partial index instead of a `boq_item` seq scan; buffers read drops.
- Confirm phase-literal strings in the migration exactly match those in `dashboard.ts` (`'internal_review'`, `'sent_to_client'`, `'client_reviewing'`) — a partial index only fires when the predicate is textually compatible.
- Existing dashboard tests (stat counts, pending lists) still pass — pure index add, no result change.
- Apply to dev (`psql $DATABASE_URL -f ...`), verify, then prod. `IF NOT EXISTS` makes re-runs safe.

## Risks / notes

- Two extra small indexes add negligible write cost on `boq_item` phase transitions.
- If more client-visible phases are added later, keep the `IN (...)` predicate list in sync or the index silently stops covering the new phase.
- Partial-index predicate must be an immutable expression — plain equality/`IN` on a text column qualifies.
