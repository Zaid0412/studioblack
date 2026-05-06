# BOQ — Client Rate & Budget Rate

> **Scope:** add two new pricing fields to `element` and `boq_item`. Surfaces
> drawer-side UX in v1 with optional follow-on phases for table columns,
> Excel round-trip, and variance highlights.
> **Companion plans:** `boq-implementation-plan.md`, `boq-enhancements-plan.md`.
> **Inspiration:** RDash element form — separates internal cost from
> client-facing rate, plus a budget reference for variance analysis.

---

## Overview

Today every BOQ line carries a single internal `unit_cost` plus markup
columns (`overhead_pct`, `service_charge_pct`, `margin_pct`) that compute
`sell_price` server-side. There is no separate **client-facing rate** and no
**budget reference** for variance tracking.

Studios that price differently for different clients (markup ladders,
project-specific discounts, tiered pricing) need a stored client rate
distinct from the cost build-up. PMs running cost discipline want a budget
rate they can compare actuals against.

Both fields are independent of `sell_price`. Adding them does not change
the existing computation — they sit beside it as additional stored values.

---

## Decisions to make before we start

These shape the scope and a couple of questions are load-bearing — worth
nailing before code:

1. **Inheritance from `element` to `boq_item`?** The plan assumes yes:
   library elements carry default rates; copying an element into a BOQ
   pre-fills the line, then the line value can be edited independently of
   the library. Alternative: rates only live on `boq_item` (no library
   default). Default-flow is more useful and costs ~1 file.

2. **Currency.** Both fields inherit the BOQ's currency (no per-field
   currency). Same convention as `unit_cost`.

3. **What does "Budget Rate" mean?** Per the user's reference: the
   _internally-targeted_ per-unit cost. Compared against `unit_cost` to
   answer "are we over our budget?" — not a financial-allocation budget.

4. **Re-approval trigger.** `REAPPROVAL_FIELDS` in `src/lib/queries/boq.ts`
   currently re-flips a `client_approved` line back to `pending` when any
   material/cost field changes. **`client_rate` should be added to that
   set** (it's the field clients literally signed off on). `budget_rate`
   should **not** trigger re-approval (internal-only).

5. **Replacement of `sell_price`?** No. `client_rate` is independent. The
   existing `sell_price` (cost × markups) stays as the canonical computed
   price; `client_rate`, when set, can be displayed to the client _instead
   of_ `sell_price` on client-facing surfaces, but the data model keeps
   both.

6. **Visibility for the client role?** `client_rate` should be visible to
   clients on client-portal surfaces. `budget_rate` must **never** leak —
   it's an internal cost target. The client portal queries already
   project-filter columns; we'd just exclude `budget_rate` there.

---

## Phased delivery

The change is small enough to ship in one PR but splitting buys us
optional polish later without rework. Recommended cut:

### Phase 1 (v1, this is the proposed first PR) — Capture

Add the data model + drawer/dialog inputs. No table columns, no Excel,
no variance UX. Roughly **3-4 hours / ~250 LOC**.

### Phase 2 — Table columns

Two new columns in `BoqTable` (Client Rate, Budget Rate) with inline
editing. Bumps `GRID_COLS` and `TABLE_MIN_WIDTH`. **+1-2 hours**.

### Phase 3 — Excel round-trip

Optional columns in the parser/writer + the user-facing template.
**+1-2 hours**.

### Phase 4 — Variance highlight

`over_budget` boolean computed in SQL (`unit_cost > budget_rate`), with
the existing margin-alert pattern reused for a row badge. **+1-2 hours**.

Phases 2-4 are independent and can ship in any order or be skipped
entirely.

---

## Phase 1 — Capture (this PR)

### Database

Two new columns on each table. Both nullable; no backfill required.

```sql
-- scripts/migrate-boq-client-budget-rates.sql

ALTER TABLE element
  ADD COLUMN IF NOT EXISTS client_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_rate NUMERIC(12,2);

ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS client_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_rate NUMERIC(12,2);
```

`NUMERIC(12,2)` mirrors the precision of `unit_cost`. Nullable so existing
elements/items stay clean — we don't synthesise a default rate.

### Validation schemas (`src/lib/validations.ts`)

Extend `createElementSchema`, `updateElementSchema`, `createBoqItemSchema`,
`updateBoqItemSchema` with two optional, non-negative money fields:

```ts
clientRate: nonNegativeMoney.optional().nullable(),
budgetRate: nonNegativeMoney.optional().nullable(),
```

`nonNegativeMoney` already exists in this file. Both are nullable so the
client can clear a previously-set rate by sending `null`.

### Types (`src/types/index.ts`)

Extend `Element`, `BoqItem`, and `BoqItemWithComputed`:

```ts
client_rate: number | null;
budget_rate: number | null;
```

### Queries

#### `src/lib/queries/elements.ts`

- Add `client_rate`, `budget_rate` to the column projection in `getElements`,
  `getElementById`, and `getVersionHistory`.
- Add to the `INSERT` column list in `createElement`.
- Add to the dynamic `UPDATE` column whitelist in `updateElement`.

#### `src/lib/queries/boq.ts`

- Add to `ITEM_COLS` (the whitelist used by `updateBoqItem`).
- Add to `REAPPROVAL_FIELDS` for `client_rate` only (per decision #4 above).
- Add to the SELECT projection in `getBoqWithDetails`,
  `getBoqItemById`, etc.
- Add to the `INSERT` in `createBoqItem`.
- **Library default-flow:** in `createBoqItemFromElement` (the path that
  copies an element's costs into a new BOQ line), copy the element's
  `client_rate` and `budget_rate` into the new line. The line can then be
  edited independently.

### UI

#### `ElementFormDialog`

After the existing cost build-up section (material/labour/overhead/margin),
add a new "Pricing" sub-section with two inputs:

```
┌─────────────────────────────┬─────────────────────────────┐
│ Client Rate (₹)             │ Budget Rate (₹)             │
│ ─────────────────────────── │ ─────────────────────────── │
│ [Enter Client Rate]         │ [Enter Budget Rate]         │
└─────────────────────────────┴─────────────────────────────┘
```

Number inputs, optional, currency suffix matching the project/element
currency.

#### `BoqCreateItemDialog`

Add the same two inputs in a new row alongside the existing
`Service charge %` / `Margin %` row, or in their own row below. Both
optional. Defaults to whatever the element supplied via `library
default-flow` if the dialog was opened from an element pick; empty
otherwise.

#### `BoqItemDrawer`

Two more `EditableField` blocks in the metrics grid. They sit alongside
the existing inline-editable cells (qty, unit cost, margin, overhead,
service charge). Same blur-to-save pattern. **No new components** —
`EditableField` already covers the case.

### Tests

- **Validation tests** (`src/test/unit/validations.test.ts`): accept both
  fields, reject negative values, accept null.
- **Query tests** for `createBoqItemFromElement` covering the inheritance:
  given an element with `client_rate = 250`, the new BOQ line has
  `client_rate = 250`.
- **API pass-through tests**: `PATCH /api/elements/[id]` and `PATCH
/api/projects/[id]/boq/items/[itemId]` accept and persist both fields.
- **REAPPROVAL trigger test**: changing `client_rate` on an
  `approved` BOQ item flips it back to `pending`.

### Files touched (Phase 1)

- `scripts/migrate-boq-client-budget-rates.sql` — new
- `src/lib/validations.ts` — extend 4 schemas
- `src/types/index.ts` — extend 3 interfaces
- `src/lib/queries/elements.ts` — projections + insert/update
- `src/lib/queries/boq.ts` — `ITEM_COLS`, `REAPPROVAL_FIELDS`, projections,
  `createBoqItemFromElement` inheritance
- `src/app/(dashboard)/elements/_components/ElementFormDialog.tsx`
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqCreateItemDialog.tsx`
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqItemDrawer.tsx`
- `src/test/unit/validations.test.ts` — extend
- `src/test/api/boq-items.test.ts` — extend (REAPPROVAL + pass-through)
- `src/test/api/elements.test.ts` — extend (pass-through)
- 1 new test file for `createBoqItemFromElement` inheritance, or extend
  the existing query test if there is one

Estimate: **~10 files, ~250 LOC, ~3-4 hours.**

---

## Phase 2 — Table columns (optional, separate PR)

Bumps `GRID_COLS` from 12 → 14 columns. New widths:

```
70px  client → 90px      (Client Rate, currency)
70px  budget → 90px      (Budget Rate, currency)
```

`TABLE_MIN_WIDTH` goes from `1187px` → `1187 + 90×2 + 8×2 = 1383px`.
Bigger horizontal scroll on narrow screens, which we already handle since
the table is wrapped in `overflow-x-auto`.

`BoqTable` header gets two new `<div className="text-right">…</div>` cells;
`BoqItemRow` gets two new inline-editable `BoqEditableCell`s wired to
`save({ clientRate: parseFloat(next) })` / `save({ budgetRate: ... })`.

`BoqTabSkeleton` mirrors the change.

---

## Phase 3 — Excel round-trip (optional, separate PR)

- `src/lib/excel/elementParser.ts` — accept `Client Rate` / `Budget Rate`
  optional columns; map to `clientRate` / `budgetRate`.
- `src/lib/excel/boqParser.ts` — same.
- `src/lib/excel/elementWriter.ts` / `boqWriter.ts` — emit the columns.
- Update the user-facing import templates and example rows.
- Tests in `src/test/api/elements-import.test.ts`,
  `src/test/api/boq-import.test.ts`, and the corresponding `*-export.test.ts`.

---

## Phase 4 — Variance UX (optional, separate PR)

Compute `over_budget` in the same SQL CTE that produces `margin_alert` and
the computed cost columns:

```sql
CASE
  WHEN budget_rate IS NOT NULL AND unit_cost > budget_rate
    THEN true
  ELSE false
END AS over_budget,

CASE
  WHEN budget_rate IS NOT NULL AND budget_rate > 0
    THEN ((unit_cost - budget_rate) / budget_rate * 100)
  ELSE NULL
END AS budget_variance_pct
```

Surface in `BoqItemRow` as a small red badge in the Margin column area or
as a row-end indicator: `▲ 12% over budget`. Same visual treatment as
`margin_alert`.

`BoqItemDrawer` shows the variance prominently below the Budget Rate
input.

`BoqSummaryCards` could carry a "Lines over budget" stat (count + %)
alongside the existing margin/total stats.

---

## Open questions parking lot

- **Multi-tier client rates** — different rates per client tier? Out of
  scope for v1; a single `client_rate` column. If needed, becomes a
  separate `element_rate` table later.
- **Historical budget rates** — does updating `budget_rate` on an
  in-flight project rewrite the variance for already-quoted lines? v1
  says yes (just stores the latest). If we later want a frozen "approved
  budget", that's a `boq_budget_snapshot` table — out of scope.
- **Client portal surface** — show `client_rate` on the client-facing BOQ
  view? Probably yes, defaulting to `client_rate` if set, else
  `sell_price`. Wire in the client-portal queries when we get there.

---

## Risks

- **Data semantics drift.** Two new optional columns mean four pricing
  values per line (`unit_cost`, `sell_price`, `client_rate`, `budget_rate`)
  plus markup percents. Worth a short doc snippet in the README/PRD
  defining when each is used. Without it new contributors will guess.
- **`REAPPROVAL_FIELDS` decision sticks.** Whatever we put there ships to
  customers and changing it later is annoying (existing approved lines
  may need bulk re-approval). Triple-check decision #4 before merging.
- **Currency drift.** No per-field currency means a project that switches
  currency mid-flight has stale rates. Same risk we already have on
  `unit_cost`; not new.
