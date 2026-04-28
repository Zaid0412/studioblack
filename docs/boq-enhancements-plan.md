# BOQ Enhancements Plan

> **Scope:** follow-up work on top of the shipped F4 / F5 / F6 (PRs #75, #76, #77).
> **Inspiration:** RDash BOQ surface (`help.rdash.io/articles/705215-create-my-active-scope`).
> **Companion plan:** `docs/boq-implementation-plan.md` (master sequence; F7.5 and F14.5 live there).

---

## Overview

Three additions to the existing BOQ surface, bundled into a single feature/PR because they all touch the same migration, queries, table, and item drawer:

1. **Section chip strip + per-section totals row** — sticky chip-tab nav above the table for fast section jumping, and a totals row at the bottom of each expanded section to mirror the section header.
2. **`source` provenance column on `boq_item`** — `'custom' | 'library' | 'project' | 'rate_contract'`, set automatically by the create flow, displayed as a badge column with a filter chip.
3. **Service charge** — `service_charge_pct` line modifier on `boq_item` and `element` (so it default-flows from the library), folded into cost calculations and the existing Excel round-trip.

Bundling rationale: one migration on `boq_item`, one set of edits to `BoqTable.tsx` / `BoqItemDrawer.tsx` / `boqParser.ts` / `boqWriter.ts`, one i18n pass. Splitting would triple the review surface for the same diff.

---

## Feature 6.1: BOQ Table Enhancements

### Goal

Bring the shipped BOQ table closer to the RDash UX without changing the data model assumptions baked into F4. Specifically: improve navigation between sections, surface each row's provenance, and make service-charge pricing first-class instead of being squeezed into `overhead_pct`.

### Database

**New migration:** `scripts/migrate-boq-enhancements.sql`

```sql
BEGIN;

-- 1. source column on boq_item
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'custom'
    CHECK (source IN ('custom','library','project','rate_contract'));

-- Backfill: any row already linked to an element came from the library.
UPDATE boq_item SET source = 'library'
 WHERE source = 'custom' AND element_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boq_item_source ON boq_item(boq_id, source);

-- 2. service_charge_pct on boq_item
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS service_charge_pct NUMERIC(5,2) DEFAULT 0;

-- 3. service_charge_pct on element so the library can default-flow it.
ALTER TABLE element
  ADD COLUMN IF NOT EXISTS service_charge_pct NUMERIC(5,2) DEFAULT 0;

COMMIT;
```

No data migration is needed for service charge — `0` is the sensible default and the cost expressions degrade cleanly when the column is zero.

### Cost calculation update

Per F4, sell price is computed in SQL:

```sql
quantity * unit_cost * (1 + overhead_pct/100) * (1 + margin_pct/100) AS sell_price
```

Service charge is applied **after overhead, before margin** (matches RDash's "service charge added to cost"):

```sql
quantity * unit_cost
  * (1 + overhead_pct/100)
  * (1 + service_charge_pct/100)
  * (1 + margin_pct/100) AS sell_price
```

Update every read path that computes `sell_price` / `total_cost` in `src/lib/queries/boq.ts`. Search for the cost expressions and add the service-charge factor in lockstep.

### Queries — `src/lib/queries/boq.ts`

- `createBoqItem` (~L384) — accept `source` param, default `'custom'`; accept `service_charge_pct`, default `0`. Add both columns to the INSERT column list.
- `addElementToBoq` (~L620) — pass `source: 'library'`; copy `service_charge_pct` from the source element row.
- `bulkUpsertBoqItems` (~L977, used by the import flow) — same two columns added to the INSERT.
- `updateBoqItem` — add both fields to the allow-list.
- `getBoqSummary` — extend the per-section roll-up to include service-charge totals (optional; only if the bottom totals row needs to show service charge separately).

The Excel column importer (`src/lib/excel/boqParser.ts`) gains a `Service Charge %` column. Source is **not** importable — it's set to `'custom'` for any imported row, since the user is hand-writing the spreadsheet.

`src/lib/queries/elements.ts` — extend the element CRUD path: add `service_charge_pct` to the INSERT, UPDATE allow-list, and `duplicateElement` copy list. Mirrors how `image_url` etc. were added in PR #80.

### API

No new routes. The existing routes carry the new fields through their Zod schemas.

`src/lib/validations.ts`:

- Extend `createBoqItemSchema` and `updateBoqItemSchema` with `service_charge_pct: z.coerce.number().min(0).max(999).optional()`.
- Extend `createElementSchema` and `updateElementSchema` the same way.
- `source` is **server-set** — exclude it from request schemas. The server wires it in based on which create path the request hit.

### UI

**Section chip strip** — `src/app/(dashboard)/projects/[id]/boq/_components/BoqTable.tsx`:

Add a `BoqSectionChips` component above the existing table (sticky to the top of the scroll container). Each chip:

```
[ Section Name  3 ]   ← element count badge
```

Clicking a chip scrolls the table to that section's header (`scrollIntoView({ behavior: 'smooth', block: 'start' })`) and expands it if collapsed. An "Unsectioned" chip is rendered iff there are unsectioned items. The active chip (the section currently in view) gets the primary highlight — track via `IntersectionObserver` on the section header refs.

Chip strip is keyboard-navigable (left/right arrow keys) and overflows horizontally on narrow screens.

**Per-section totals row** — `BoqTable.tsx`:

Below the last row of each expanded section, render a totals row:

```
                                                    Section Total: $1,234.00
```

The header already shows the total, so this row is duplicative on a single-screen view, but matches RDash's pattern and keeps the total in view when the user has scrolled past the header. Add a `BoqSectionFooter` component that renders the same `formatCurrency(sectionTotal, currency)` value as the header. Skip the row when the section is collapsed.

**Source column** — `BoqTable.tsx`:

Add a `Source` column between `Description` and `Unit`. Renders a small `Badge` component:

| Source         | Badge label    | Tone    |
| -------------- | -------------- | ------- |
| `custom`       | Custom         | neutral |
| `library`      | Library        | primary |
| `project`      | Project        | accent  |
| `rate_contract`| Rate Contract  | success |

The `rate_contract` value is reserved — it stays unused until F7.5 (Rate Contracts) ships. No fallback / "Unknown" badge: every row has a non-null source thanks to the migration default + backfill.

Filter chip in `BoqActionBar.tsx`: a `Source` multi-select that filters via the existing client-side filter pipeline. URL state via the existing filter state (no new query param shape needed beyond `source=library,custom`).

**Service charge field** — `BoqItemDrawer.tsx`:

Add a `Service Charge %` input next to the existing `Overhead %` field. Shows the live computed sell price below the form so the user sees the impact. Default value pulled from the linked element on item create — `addElementToBoq` already does this server-side, so the drawer just renders whatever the row has.

`ElementFormDialog.tsx` (in `src/app/(dashboard)/elements/_components/`): add the same input next to overhead/margin. Same behaviour as the existing percent fields — no new patterns.

**Excel template** — `src/lib/excel/boqWriter.ts` and `boqParser.ts`:

Extend `BOQ_TEMPLATE_COLUMN_ORDER` with a `serviceChargePct` column between `overheadPct` and `marginPct`. The parser tolerates the column being missing (fallback to `0`) so existing templates keep working — same compat strategy as the F6 spec.

### i18n

Add to `messages/en.json` + `messages/tr.json`:

```jsonc
"boq": {
  "table": {
    "columnSource": "Source",
    "columnServiceCharge": "Service Charge %",
    "sectionTotal": "Section total",
    "sourceCustom": "Custom",
    "sourceLibrary": "Library",
    "sourceProject": "Project",
    "sourceRateContract": "Rate Contract",
    "filterBySource": "Filter by source"
  }
}
```

### Tests

- `src/test/api/boq-items.test.ts` — extend: assert `source` is set per create path (custom drawer → `custom`, library picker → `library`); assert `service_charge_pct` validation rejects negative; assert sell-price computation includes service charge.
- `src/test/api/elements.test.ts` — extend: `service_charge_pct` round-trips through create + update + duplicate.
- `src/test/api/boq-import.test.ts` — extend: importing without the `Service Charge %` column defaults to `0`; importing with a value sets it.
- `src/test/unit/boqWriter.test.ts` (new if missing) — exporter writes the new column and round-trips through the parser.

### Files to create / modify

**New:**
- `scripts/migrate-boq-enhancements.sql`
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqSectionChips.tsx`
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqSectionFooter.tsx`

**Modify:**
- `src/lib/queries/boq.ts` (cost expressions, `createBoqItem`, `addElementToBoq`, `bulkUpsertBoqItems`, `updateBoqItem` allow-list, `getBoqSummary`)
- `src/lib/queries/elements.ts` (`service_charge_pct` in INSERT/UPDATE/duplicate)
- `src/lib/validations.ts` (Zod schema extensions)
- `src/types/index.ts` (extend `BoqItem` and `Element` types)
- `src/lib/excel/boqWriter.ts` (template column)
- `src/lib/excel/boqParser.ts` (template column with default fallback)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqTable.tsx` (chip strip, source column, footer row)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqActionBar.tsx` (source filter)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqItemDrawer.tsx` (service-charge field)
- `src/app/(dashboard)/elements/_components/ElementFormDialog.tsx` (service-charge field)
- `messages/en.json`, `messages/tr.json`

### Open decisions

1. **Should `source` be user-overridable?** Default plan: no — `source` is provenance, written once at create time, not edited afterward. RDash treats it the same way. Push back if you want it editable.
2. **Bottom totals row when section is short.** When a section has 1–2 items the duplicated total feels noisy. Option A: always render. Option B: only render when section has ≥ N items. Default plan: **always render** — matches RDash, predictable for users.
3. **Service charge placement in cost formula.** Plan above puts it between overhead and margin. Alternative: between margin and VAT (i.e. on the sell side, not the cost side). RDash treats it as an addition to the cost. Default plan: **on the cost side** (matches RDash + is more conservative — avoids inflating reported margin).

### Estimated scope

| Surface                  | New lines | Modified files |
| ------------------------ | --------- | -------------- |
| Migration + queries      | ~80       | 2              |
| Validations + types      | ~30       | 2              |
| Excel round-trip         | ~25       | 2              |
| BOQ table UI             | ~250      | 5              |
| Element form             | ~15       | 1              |
| i18n                     | ~30       | 2              |
| Tests                    | ~120      | 3              |

**Complexity:** Medium. One migration, no new tables, no new endpoints. UI is the biggest piece — the chip strip with sticky-active behaviour is the only genuinely new component.

---

## Notes

- Ship as **one PR**: `feat(boq): table enhancements (F6.1)` — chips, source, service charge.
- Feature flag: not needed. These are purely additive on existing surfaces.
- Roll-back: dropping the columns is the rollback. Index on `source` is cheap to rebuild if needed.
- Keep the dependency graph in `docs/boq-implementation-plan.md` accurate when this lands — F6.1 sits between F6 and F7.5 in the sequence.
