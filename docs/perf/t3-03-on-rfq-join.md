# BOQ `on_rfq` flag: replace per-row EXISTS with a single LEFT JOIN

- **Tier / Impact / Effort:** T3 · Med · M
- **Area:** db
- **Files:** `src/lib/queries/boq.ts:64-94` (ITEM_COMPUTED_COLS, `on_rfq` EXISTS at :88-93), `src/lib/queries/boq.ts:105` (ITEM_SELECT), `src/lib/queries/boq.ts:345-348` (getBoq itemsRes); index `scripts/migrate-rfq.sql:71` (idx_rfq_item_boq)

## Problem

`ITEM_COMPUTED_COLS` carries a per-row correlated subquery to compute `on_rfq`:

```sql
EXISTS (
  SELECT 1 FROM rfq_item ri
  JOIN rfq r ON r.id = ri.rfq_id
  WHERE ri.boq_item_id = bi.id
    AND r.status NOT IN ('cancelled', 'superseded')
) AS on_rfq
```

`idx_rfq_item_boq (boq_item_id)` covers each probe, but `ITEM_SELECT` is the main BOQ read (`getBoq`, `boq.ts:345`) and a real BOQ runs 300–500 line items. That's 300–500 index-EXISTS probes (each with a nested join to `rfq` for the status filter) on every BOQ open. The correlation defeats set-based execution — it's N round-trips through the index instead of one join.

## Fix

Pre-aggregate the "live RFQ" set once and `LEFT JOIN` it, exposing `on_rfq` as a null-check:

- Add a derived table of BOQ-item ids that sit on a live RFQ:

```sql
LEFT JOIN (
  SELECT DISTINCT ri.boq_item_id
    FROM rfq_item ri
    JOIN rfq r ON r.id = ri.rfq_id
   WHERE r.status NOT IN ('cancelled', 'superseded')
) live_rfq ON live_rfq.boq_item_id = bi.id
```

- Replace the `EXISTS (...) AS on_rfq` line in `ITEM_COMPUTED_COLS` with `(live_rfq.boq_item_id IS NOT NULL) AS on_rfq`.
- The join must be added to `ITEM_SELECT` (`boq.ts:105`) alongside `ITEM_LIBRARY_JOIN`, since `ITEM_COMPUTED_COLS` now references `live_rfq`.

One hash join of the (small) live-RFQ id set against the BOQ's items, versus N correlated probes. The planner builds the `DISTINCT` set once and hash-probes it per row.

⚠️ **Coupling check:** `ITEM_COMPUTED_COLS` and `ITEM_SELECT` are shared. Confirm every consumer of `ITEM_SELECT` (and the four mutation queries that return a fresh item row via these fragments — create / update / move / lifecycle, per the `boq.ts:96-105` comment) either includes the new join or doesn't reference `on_rfq`. If the computed-cols fragment is reused *without* `ITEM_SELECT`'s FROM/JOIN clause anywhere, the `live_rfq` reference will break that query — audit all usages of both constants before changing them. Safest: keep `on_rfq`'s EXISTS in a variant used by single-row mutation returns (1 probe is fine) and only swap the JOIN form into the list path (`getBoq`), if the constants are shared across both.

## Verification

- `getBoq` output unchanged: `on_rfq` true/false per item matches the EXISTS version. Extend/confirm a test with a BOQ item on a live RFQ, one on a cancelled/superseded RFQ (→ false), and one on none (→ false).
- `EXPLAIN (ANALYZE)` on the `getBoq` items query shows a single Hash Join / Hash Right Join against the derived `live_rfq` set, not N SubPlan executions.
- Verify the four mutation return-row queries still compile and return correct `on_rfq` after the constant change.

## Risks / notes

- Main risk is the shared-constant coupling — this is the crux. Do not change `ITEM_COMPUTED_COLS` in isolation without tracing `ITEM_SELECT` and the mutation queries. A missing `live_rfq` join surfaces as a SQL error, so tests will catch it, but map the usages first.
- `DISTINCT` in the derived table keeps the LEFT JOIN one-to-(zero-or-one), so it can't fan out BOQ item rows.
- No schema/index change — `idx_rfq_item_boq` still serves the join; the win is set-based vs correlated execution.
