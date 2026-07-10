# `getBestRateForElements` N+1 → single set-based query

- **Tier / Impact / Effort:** T2 · High · M
- **Area:** db
- **Files:** `src/lib/queries/rateContracts.ts:455-468` (`getBestRateForElements`), `src/lib/queries/rateContracts.ts:342-422` (`getActiveRatesForBoqItem`, the per-element query it fans out to), `src/app/api/projects/[id]/boq/rate-availability/route.ts:12-28` (caller), `src/test/api/boq-rate-availability.test.ts` (existing test)

## Problem

`getBestRateForElements(orgId, elementIds)` de-dupes the ids then fans out with
`runWithConcurrency(unique, 8, …)`, calling `getActiveRatesForBoqItem(orgId, { elementId })`
once per element (`rateContracts.ts:463-466`). Each of those calls issues the full
`WITH RECURSIVE effective … anc … CROSS JOIN effective` query at `rateContracts.ts:362-419`
— a per-element ancestor-category walk joined to `rate_contract_item` / `rate_contract`
/ `vendor` / `element_category`, ordered by `match_type` then cheapest rate, of which
only `rows[0]` is kept.

This is a true N+1. The endpoint (`.../boq/rate-availability`) powers the "rate contract
available" hint on the RFQ-create picker, which checks an entire BOQ section at once —
60-100 elements → 60-100 recursive-CTE round-trips per request, capped only by a
concurrency of 8 (so ~8-13 sequential waves against the pool). The recursive CTE +
four joins are re-planned and re-executed for every element even though the contract
rows scanned overlap heavily across elements in the same section.

## Fix

Rewrite `getBestRateForElements` as **one** set-based query that keeps the exact ranking
semantics of `getActiveRatesForBoqItem` (element > service_area > ancestor, then cheapest
rate, then latest `end_date`) but resolves all elements at once. `getActiveRatesForBoqItem`
stays as-is for the single-item callers (`getActiveRatesForBoqItemById`).

SQL shape (single query, `$1 = orgId`, `$2 = uuid[]` of the distinct element ids):

```sql
WITH input AS (
  SELECT DISTINCT id AS element_id FROM unnest($2::uuid[]) AS t(id)
),
-- resolve each input element's own effective category once
eff AS (
  SELECT i.element_id, e.category_id
  FROM input i
  JOIN element e ON e.id = i.element_id
),
-- walk every DISTINCT effective category up to the root a single time,
-- tagging each ancestor with the leaf category it descends from
RECURSIVE anc AS (
  SELECT DISTINCT category_id AS leaf_id, category_id AS id, parent_id
    FROM element_category
   WHERE id IN (SELECT category_id FROM eff)
  UNION ALL
  SELECT a.leaf_id, p.id, p.parent_id
    FROM element_category p
    JOIN anc a ON p.id = a.parent_id
),
candidate AS (
  SELECT
    eff.element_id,
    rci.id  AS rate_contract_item_id,
    rc.id   AS rate_contract_id,
    rc.contract_number, rc.name AS contract_name,
    rc.vendor_id, v.company_name AS vendor_name,
    cat.id AS category_id, cat.name AS category_name, cat.code_prefix AS category_code,
    e.id AS element_id_join, e.code AS element_code, e.name AS element_name,
    rci.unit, rci.rate, rc.currency, rc.end_date,
    CASE
      WHEN rci.element_id = eff.element_id      THEN 'element'
      WHEN rci.category_id = eff.category_id    THEN 'service_area'
      ELSE 'ancestor'
    END AS match_type
  FROM eff
  JOIN rate_contract_item rci
       ON (rci.element_id = eff.element_id)
       OR (rci.element_id IS NULL
           AND rci.category_id IN (SELECT id FROM anc WHERE leaf_id = eff.category_id))
  JOIN rate_contract rc  ON rc.id = rci.rate_contract_id
  JOIN vendor v          ON v.id = rc.vendor_id
  JOIN element_category cat ON cat.id = rci.category_id AND cat.is_active = true
  LEFT JOIN element e    ON e.id = rci.element_id
  WHERE rc.org_id = $1
    AND rc.status = 'active'
    AND (rci.element_id IS NULL OR e.is_active = true)
)
SELECT DISTINCT ON (element_id) *
FROM candidate
ORDER BY element_id,
  CASE match_type WHEN 'element' THEN 0 WHEN 'service_area' THEN 1 ELSE 2 END,
  rate ASC, end_date DESC;
```

Then in TS: seed `result[id] = null` for every unique input id (so elements with no
match still appear as `null`, matching current behavior where `rates[0] ?? null`), map
rows to `AvailableRate` with `rate: Number(r.rate)`, and assign by `element_id`. Drop the
`runWithConcurrency` import here if it becomes unused.

Notes / gotchas:

- The `anc` CTE must be tagged with `leaf_id` so an ancestor category only matches the
  element whose category actually descends from it — a plain `IN (SELECT id FROM anc)`
  would cross-match elements. Keep the `leaf_id = eff.category_id` join predicate.
- `DISTINCT ON (element_id)` with the `ORDER BY` reproduces "take `rows[0]`" per element.
- No `vendorId` filter is needed here (the batch caller never passes one); leave that
  parameter path in `getActiveRatesForBoqItem` untouched.

## Verification

- Extend / add a unit test (co-located with `src/test/api/boq-rate-availability.test.ts`,
  or a new `src/test/unit/rate-best-batch.test.ts`) that:
  - builds a multi-element set spanning all three `match_type` tiers (direct element match,
    service-area/category match, ancestor match) plus an element with no rate → asserts the
    per-element best rate and that the no-match element maps to `null`.
  - asserts cheapest-wins and `end_date DESC` tie-breaks are preserved.
  - **Asserts a single `pool.query` call is issued** for the whole batch (the DB mock in
    `src/test/setup.ts` records calls — assert `mockQuery` was called once for the batch path,
    vs. N times before).
- Differential check: for a representative set, assert the new function's output equals the
  old per-element `getActiveRatesForBoqItem(...)[0] ?? null` path (can be done in-test by
  keeping a reference loop over the same fixtures).
- `npm run check` + `npm test`.

## Risks / notes

- Ranking correctness is the whole value here — the `leaf_id`-tagged recursive CTE is the
  subtle part. Cover ancestor matching explicitly in tests.
- The single query is heavier per-execution than one element's query but replaces 60-100 of
  them; net planner + round-trip savings are large. Confirm `rate_contract_item(category_id)`
  / `(element_id)` and `rate_contract(org_id, status)` indexes exist (they back the current
  per-element query already, so no new index expected).
- Behavior for duplicate input ids and empty input (`return {}`) must match the current
  contract consumed by the route at `route.ts:22`.
