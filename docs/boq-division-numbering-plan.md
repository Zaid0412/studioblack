# Mandatory Divisions + Per-Division Line Numbering (`PLB-10`)

## Context

Per the BOQ Structure & Division Design spec (PRD sub-doc under Tab 6, §§2–4):

- Every BOQ line item **belongs to a Division** — Division is **mandatory**.
- Line numbers **restart at 10 for each Division**, increment 10 (the project's
  configurable `line_increment`), and are **unique within a Division**. Sections
  do not restart numbering.
- The line's business reference is shown as **`<CODE>-<NN>`** (e.g. `PLB-20`),
  where `CODE` is the division's 3-char code.

**Today's code differs on all three axes:**

- Division lives on the **section** (`boq_item → section → division`), both hops
  nullable — so division is **optional**, and there's no division field on the
  add-line form (the required classification there is *Service Area* /
  `category_id`, a separate concept).
- Line numbering is **BOQ-wide continuous** (#207): `MAX(line_number)` across the
  whole BOQ; one `ROW_NUMBER()` renumber over the whole BOQ.
- The line number renders as a bare integer in 3 places; `division.code` isn't
  joined into the row.

So this reworks the data model, all three numbering functions, validation, the
add-line UI, and the display.

## Decisions (confirmed with the user)

1. **Prefix source** — the division's existing admin-editable **`code`** (Plumbing
   → `PLB`), matching the doc. Tighten codes to exactly 3 chars (rename the one
   4-char default, `HVAC` → `HVC`). *Not* "first 3 letters of the name."
2. **Division placement** — a new **`division_id` directly on the line**
   (mandatory), with a division picker on the add-line form. Matches the doc
   hierarchy (items belong to a division; sections optional under it).
3. **Backfill** — assign any existing undivisioned line to a default **General
   (`GEN`)** division, then renumber every BOQ per-division.

## Stages

### Stage 1 — Schema + backfill
`scripts/migrate-boq-item-division.sql`:
- `ALTER TABLE boq_item ADD COLUMN division_id UUID REFERENCES division(id)` — nullable first.
- Ensure every org has a **General `GEN`** division (create if missing — already in the seed).
- Backfill `boq_item.division_id` = its section's `division_id`, else the org's `GEN`.
- Renumber every BOQ **per division** (Stage 3 logic), then `ALTER … SET NOT NULL`.
- Replace index `idx_boq_item_line(boq_id, line_number)` → `(boq_id, division_id, line_number)`.

### Stage 2 — Division mandatory on the line
- `src/lib/validations.ts`: `createBoqItemSchema.divisionId: uuid` (required);
  `updateBoqItemSchema.divisionId: uuid.optional()` (allow reclassify).
- Route `src/app/api/projects/[id]/boq/items/route.ts`: validate the division via
  the existing `divisionBelongsToOrg`, mirroring `requireServiceArea`.
- `createBoqItem` / `updateBoqItem` (`src/lib/queries/boq.ts`): store `division_id`.
  **Internal callers** (`addElementToBoq`, batch add, import) fall back to the org's
  `GEN` division so `NOT NULL` always holds without threading division through every path.

### Stage 3 — Per-division numbering (core — `src/lib/queries/boq.ts`)
- `createBoqItem` append: `MAX(line_number) WHERE boq_id=$1 AND division_id=$div) + increment`
  → first line in a division = 10.
- `renumberBoqContinuous` → **partition by division**:
  `ROW_NUMBER() OVER (PARTITION BY division_id ORDER BY <section sort>, <item sort>) * increment`.
- `insertBoqItemBetween` / `insertBounds`: neighbour bounds scoped to the anchor's
  **division** (`MIN/MAX(line_number) WHERE boq_id AND division_id = anchorDivision AND …`);
  `NeedsRenumberError` raised per-division. `withBoqRenumber` unchanged (one advisory
  lock + renumber).
- Moving a line to another division renumbers naturally (whole-BOQ per-division renumber
  reassigns it into the new division's sequence).

### Stage 4 — Add-line UI (`BoqCreateItemSheet.tsx`)
- Add a **required Division picker** (via the `useDivisions` hook). The optional
  Section picker is filtered to that division; picking a section defaults/locks the
  division to the section's. Service Area (`category_id`) stays as its own field.

### Stage 5 — `CODE-NN` display
- Join `div.code` into item rows (`ITEM_LIBRARY_COLS` currently selects only `div.name`).
- New shared `formatBoqLineRef(code, lineNumber)` → `PLB-20`; use it in the 3 sites
  that render the bare integer today: `BoqTable.tsx`, `BoqItemDrawer.tsx`, `src/lib/boq/pdf.tsx`.
  Falls back to the bare number if a code is somehow absent.

### Stage 6 — 3-char codes
- Tighten `createDivisionSchema` / `updateDivisionSchema` code to **max 3**
  (`src/lib/validations.ts`); migrate existing >3-char codes (seed's `HVAC` → `HVC`) and
  update `src/lib/divisionTemplates.ts`. Optionally narrow `division.code` `VARCHAR(10)` →
  `VARCHAR(3)` after the rename (or leave the column and rely on validation).

### Stage 7 — Tests
- Per-division numbering: restart at 10, per-division insert-between, per-division renumber.
- Division-required validation + route gate; internal-caller `GEN` fallback.
- `formatBoqLineRef` unit test.
- Update existing BOQ-numbering tests (`boq-continuous-numbering.test.ts`,
  `insertBoqItemBetween.test.ts`) — they assume BOQ-wide continuous.

## Out of scope (flagged)

- Replacing the org seed with the doc's full **26-division standard table** — keeping
  existing divisions and only fixing the 3-char codes, unless the full list is wanted too.
- Hard-enforcing that a section's division always equals its items' divisions
  (v1: the item's `division_id` is authoritative for numbering/display; section is an
  optional grouping defaulted from/into it).

## Verification

1. `npm run check` + `npm run test:all` + `next build`.
2. Apply `migrate-boq-item-division.sql` to **dev** (studioblack-studio scope only for any
   test data); confirm existing BOQs renumber per-division and display `CODE-NN`.
3. Add a line: Division required; numbers restart at 10 per division; insert-between stays
   within the division; a line moved to another division re-numbers into that division.
4. Settings → Divisions: codes capped at 3 chars; `HVAC` shows as `HVC`.
5. Prod migration only on user go-ahead (additive column + backfill + renumber).

## Risk notes

- **Replaces #207's BOQ-wide continuous numbering** — every core numbering function changes;
  line_number alone no longer identifies a line within a BOQ (repeats across divisions), which
  is why the `CODE-NN` reference exists. Any code sorting/looking up by bare BOQ-wide
  `line_number` must become division-scoped.
- **`NOT NULL` on `boq_item.division_id`** requires every create path to supply a division;
  the `GEN` fallback in `createBoqItem` covers internal/import callers.
