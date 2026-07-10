# List count aggregates: LATERAL per-row instead of full-table GROUP BY

- **Tier / Impact / Effort:** T3 · Med · M
- **Area:** db
- **Files:** `src/lib/queries/vendors.ts:236-247` (getVendors contact/trade count joins), `src/lib/queries/rateContracts.ts:188-194` (listRateContracts item_count join); indexes `scripts/migrate-vendors.sql:56` (idx_vendor_contact_vendor), `scripts/migrate-vendors.sql:72` (idx_vendor_trade_vendor), `scripts/migrate-rate-contracts.sql:46` (idx_rate_contract_item_contract)

## Problem

Both list queries LEFT JOIN **uncorrelated** derived tables that aggregate an _entire_ child table with no org/tenant filter, just to attach counts to a page of ≤25 rows.

`getVendors` (`vendors.ts:237-247`):

```sql
LEFT JOIN (
  SELECT vendor_id, COUNT(*) AS cnt,
         MAX(CASE WHEN is_primary THEN email END) AS primary_email
  FROM vendor_contact GROUP BY vendor_id
) c ON c.vendor_id = v.id
LEFT JOIN (
  SELECT vendor_id, COUNT(*) AS cnt
  FROM vendor_trade GROUP BY vendor_id
) t ON t.vendor_id = v.id
```

`listRateContracts` (`rateContracts.ts:190-194`): same shape, GROUP BY over _all_ `rate_contract_item`.

The derived tables scan and group the whole child table across every tenant, then the join throws away all but the current page's vendor/contract ids. As `vendor_contact` / `vendor_trade` / `rate_contract_item` grow, every list render re-aggregates tables that are orders of magnitude larger than the 25 rows displayed.

## Fix

Replace each uncorrelated derived-table join with a correlated `LATERAL` subquery evaluated once per returned row — so only the page's rows drive index lookups.

`getVendors`:

```sql
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt,
         MAX(CASE WHEN is_primary THEN email END) AS primary_email
    FROM vendor_contact vc
   WHERE vc.vendor_id = v.id
) c ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
    FROM vendor_trade vt
   WHERE vt.vendor_id = v.id
) t ON true
```

`listRateContracts`:

```sql
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
    FROM rate_contract_item rci
   WHERE rci.rate_contract_id = rc.id
) i ON true
```

Column names (`c.cnt`, `c.primary_email`, `t.cnt`, `i.cnt`) stay identical, so the outer `SELECT ... COALESCE(c.cnt,0)` projections and the `total` window function are untouched. Each LATERAL count is an index-only-ish lookup on `idx_vendor_contact_vendor` / `idx_vendor_trade_vendor` / `idx_rate_contract_item_contract`, run only for the ≤25 rows the page returns.

⚠️ **Ordering note:** the LATERAL runs per row of the driving side. With `ORDER BY ... LIMIT`, Postgres still evaluates LATERAL before the limit unless it can push the sort down. In practice, because the join is a per-row index probe (not a full aggregation), the cost is bounded by rows examined for the sort, which is far cheaper than aggregating the whole child table. Confirm via EXPLAIN (below).

## Verification

- List output identical: `contact_count`, `primary_contact_email`, `trade_count` (vendors) and `item_count` (rate contracts) match the derived-table version, including 0 for rows with no children. Run existing list tests.
- `EXPLAIN (ANALYZE)` shows per-row Index Scans under a nested loop (LATERAL), not a HashAggregate over the full child table. Verify child-table seq scans disappear.
- Spot-check `MAX(CASE WHEN is_primary ...)` still returns the primary contact email for a vendor with multiple contacts.

## Risks / notes

- LATERAL correlated counts scale with page size (bounded, ≤ limit), not table size — the intended trade.
- If a future sort key depends on the aggregated count, LATERAL-before-limit could force evaluating counts for the full filtered set; not the case for current `VENDOR_SORT_SQL` / `RATE_CONTRACT_SORT_SQL` keys (verify none sort by `cnt`).
- No schema change; relies on existing FK indexes already present in the listed migrations.
