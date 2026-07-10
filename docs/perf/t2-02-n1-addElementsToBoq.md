# `addElementsToBoq` N+1 + non-atomic → single bulk transaction

- **Tier / Impact / Effort:** T2 · High · L
- **Area:** db
- **Files:** `src/lib/queries/boq.ts:1638-1662` (`addElementsToBoq`), `src/lib/queries/boq.ts:1550-1625` (`addElementToBoq`), `src/lib/queries/boq.ts:857-898` (`createBoqItem`), `src/lib/queries/boq.ts:2070-2086` (`getNextSequenceNumber`), `src/lib/queries/boq.ts:2098-2120` (`nextSequenceNumbers`, the batched allocator), `src/lib/queries/boq.ts:2244-2345` (`bulkInsertBoqItems`, the transactional model to follow), `src/test/api/boq-items-bulk.test.ts` / `src/test/api/boq-items.test.ts`

## Problem

`addElementsToBoq` loops `addElementToBoq` per item (`boq.ts:1651-1660`). Each iteration
does, on the **pool** (auto-committed, no shared client):

1. `SELECT … FROM element WHERE id = $1` (`boq.ts:1561-1567`)
2. optional rate-contract validation `SELECT … FROM rate_contract_item …` (`boq.ts:1576-1590`)
3. `createBoqItem` → `getNextSequenceNumber` (an `INSERT … ON CONFLICT … RETURNING` upsert
   against `sequence_counter`, `boq.ts:2070-2086`) **+** the `INSERT … RETURNING` with the
   computed-column CTE (`boq.ts:870-898`).

So ~3-4 round-trips per element. "Add 20" = 60-80 round-trips. Worse, there is **no
transaction** — the doc comment at `boq.ts:1631-1636` explicitly acknowledges partial
inserts on mid-loop failure ("the partially-added rows are consistent on their own and the
user can retry"). Each `getNextSequenceNumber` also contends on the single
`sequence_counter` row one-at-a-time, and returning `null` after some rows already committed
leaves the BOQ in a half-added state.

The Excel-import path (`bulkInsertBoqItems`, `boq.ts:2244`) already solves exactly this
shape: one transaction, one advisory lock, prefetched elements via `= ANY($2::text[])`,
and one batched sequence allocation via `nextSequenceNumbers(client, …, count)`.

## Fix

Rewrite `addElementsToBoq` to do all work in **one transaction on a single `client`**,
following `bulkInsertBoqItems`:

1. `pool.connect()` → `BEGIN`. Wrap in `try/catch/finally` with `ROLLBACK` on any error and
   `client.release()` in `finally` (copy the structure at `boq.ts:2250-2276`).
2. Optional: take the per-BOQ advisory lock (`pg_advisory_xact_lock(hashtext('boq:'||$1))`,
   `boq.ts:2266-2268`) to serialize concurrent adds against the same BOQ — matches import.
3. **One** element fetch for all ids:
   `SELECT id, code, name, description, unit, unit_cost, material_cost, labour_cost,
overhead_pct, service_charge_pct, margin_pct, client_rate, budget_rate, category_id
FROM element WHERE id = ANY($1::uuid[]) AND org_id = $2` (scope by org for safety).
   Build a `Map<elementId, row>`. If any requested id is missing → `ROLLBACK`, return `null`
   (preserves the current "any unresolved id ⇒ null, no partial insert" contract, now
   actually atomic).
4. **One** rate-contract validation for the items that carry a `rateContractItemId`. Batch
   the current per-row check (`boq.ts:1576-1590`) into a single query over the
   `(rateContractItemId, elementId)` pairs — e.g. `… WHERE (rci.id, target_element) IN
(SELECT * FROM unnest($ids::uuid[], $els::uuid[]))` with the same active-contract +
   element/ancestor-category coverage predicate (reuse `elementAncestorCategoryIdsSql`).
   Any pair that fails coverage → `ROLLBACK` + throw the same error string as
   `boq.ts:1592-1594`.
5. **One** batched sequence allocation for the rows that need a generated code:
   `nextSequenceNumbers(client, orgId, "BOQ", count)` (`boq.ts:2098`).
6. **One** multi-row insert with the computed-column projection. Model it on `createBoqItem`'s
   `WITH inserted AS (INSERT … RETURNING *) SELECT bi.*, ${ITEM_LIBRARY_COLS},
${ITEM_COMPUTED_COLS} …` (`boq.ts:871-897`), but feed rows via
   `INSERT INTO boq_item (…) SELECT * FROM UNNEST($col1[], $col2[], …) …` (or a
   `jsonb_to_recordset` payload) so all N rows insert in one statement. Preserve per-row
   semantics exactly: `source = 'rate_contract'` + rate-contract unit/rate when a
   `rateContractItemId` is present, else `'library'` with the element defaults; copy
   `client_rate` / `budget_rate` with the `!= null` loose check (`boq.ts:1622-1623`);
   `sort_order` assigned sequentially from `MAX(sort_order)+1` within the target section
   (mirror the sub-select at `boq.ts:889` but computed once for the batch, not per row).
7. `COMMIT`. Return the inserted `BoqItemWithComputed[]` in input order.

Keep `addElementToBoq` (single-item) as the thin wrapper for its other callers, or have it
delegate to the batch path with a one-element array.

## Verification

- Existing add-element / bulk tests (`src/test/api/boq-items.test.ts`,
  `src/test/api/boq-items-bulk.test.ts`) still pass.
- New test asserting:
  - **Correctness**: adding N elements (mix of library + rate-contract sourced) produces N
    rows with correct `unit_cost` / `unit` / `source` / `sort_order` and generated codes in
    order.
  - **Atomicity**: when one element id is unresolved (or a rate-contract pair fails coverage),
    **nothing** is inserted and `null`/error is returned — assert `ROLLBACK` was issued and
    no `boq_item` INSERT committed. (Use the DB mock in `src/test/setup.ts`; assert
    `BEGIN`/`ROLLBACK` ordering.)
  - **Round-trip reduction**: assert the number of `client.query` calls is bounded (a small
    constant + the single insert), not O(N) — e.g. ≤ ~5 regardless of N.
- `npm run check` + `npm test`.

## Risks / notes

- Sequence codes: use `nextSequenceNumbers` on the **transaction client** so a `ROLLBACK`
  reverses the counter advance (the whole reason it exists per `boq.ts:2093-2097`). Do not
  call the pool-based `getNextSequenceNumber` inside the tx.
- `sort_order` correctness under the advisory lock: compute the section's starting
  `sort_order` once inside the tx after acquiring the lock, then increment locally (mirror
  `boq.ts:2299-2315`).
- The multi-row insert must reproduce `createBoqItem`'s explicit `::numeric` / `::int` casts
  (`boq.ts:867-890`) or pg will infer INTEGER from `COALESCE($n, 0)` and reject fractional
  quantities/rates. This is the main correctness trap.
- Behavioral change: failure is now all-or-nothing instead of "partial rows left behind."
  This is strictly better and matches the import path; note it in the PR since the old
  comment documented the partial-insert behavior as intentional.
