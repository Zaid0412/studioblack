# BOQ import: cap the preview table render

- **Tier / Impact / Effort:** T3 · Med · S
- **Area:** rendering
- **Files:** `src/app/(dashboard)/projects/[id]/boq/_components/BoqImportDialog.tsx:367-409` (`preview.rows.map(...)` table body), `:586-588` (truncation notice, server cap = 5,000 rows), `:595-628` (RowIssues, already caps at 20)

## Problem

The import preview renders every parsed row into a `<table>` inside a `max-h-80` scrollbox: `preview.rows.map((row) => ...)` (`BoqImportDialog.tsx:367`) with 7 `<td>` cells per row (`#`, Status badge, + 5 `PREVIEW_COLUMNS`). The server truncates the sheet at **5,000 rows** (`:586-588`), so a large import builds ~5,000 × 7 ≈ **35,000 DOM nodes synchronously** — plus 5,000 `Badge` components — on the confirm/preview step. That's a long synchronous paint and a memory spike, all to fill a fixed-height scrollbox that shows ~10 rows at a time.

The `RowIssues` helper (`:595-628`) already established the right pattern: `items.slice(0, 20)` + `…and {items.length - 20} more`. The preview body just never got the same treatment.

## Fix

Cap the rendered preview rows (the full dataset still submits — only the *render* is capped). Lowest-effort, matches the existing `RowIssues` idiom:

```tsx
const PREVIEW_RENDER_CAP = 100;
...
{preview.rows.slice(0, PREVIEW_RENDER_CAP).map((row) => { ... })}
```

Then, after the `<table>` (or as a final full-width row), add an overflow note mirroring `RowIssues`:

```tsx
{preview.rows.length > PREVIEW_RENDER_CAP && (
  <p className="px-3 py-2 text-sm text-text-muted italic">
    …and {preview.rows.length - PREVIEW_RENDER_CAP} more rows (all will be imported)
  </p>
)}
```

Caps ~35,000 nodes down to ~700 (100 × 7). The confirm handler already submits `preview.rows` (or the underlying parsed payload) in full — only the JSX map is sliced, so nothing about what gets imported changes. If a scrollable full preview is a hard requirement later, virtualize the table instead (render only rows in view); the slice-cap covers the janking case with far less complexity.

## Verification

- Import a large sheet (near the 5,000-row cap): preview step no longer janks / freezes; DOM node count for the table stays ~700.
- Confirm still submits **all** rows — verify the imported BOQ item count equals the parsed row count, not the 100-row cap. (This is the load-bearing check: the cap must touch only the render, never the payload.)
- The existing "Sheet was truncated — only the first 5,000 rows were read" notice (`:586-588`) and `RowIssues` error/warning lists still render correctly.
- Error-row styling (`bg-error/5`) still visible for any error rows within the first 100; the truncation/issues summaries already surface counts beyond the cap.

## Risks / notes

- Error/warning rows beyond row 100 won't appear in the visual table, but `RowIssues` (`:417-419`) already aggregates *all* errors/warnings independent of the table render, so no diagnostic information is lost.
- Keep `PREVIEW_RENDER_CAP` (100) well below the 5,000 server cap so the "…and N more" branch is what users hit on big imports.
- Pure client render change — no API, parsing, or import-logic change.
