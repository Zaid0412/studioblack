# Move spreadsheet parse/transform off the main thread

- **Tier / Impact / Effort:** T4 · Low · M
- **Area:** rendering
- **Files:** `src/components/review/SpreadsheetViewer.tsx:65-242` (parse effect), `src/components/review/DocumentViewer.tsx:16` (dynamic import site)

## Problem

`SpreadsheetViewer.tsx` parses Excel files entirely on the main thread. The `useEffect` at lines 65-242 (a) dynamically imports `exceljs`, (b) fetches the file via `/api/proxy-file`, then (c) runs a **synchronous, cell-by-cell** transform: `workbook.worksheets.map(...)` → for each sheet, `ws.eachRow(...)` → `row.eachCell(...)` with per-cell value coercion, `numFmt`/type mapping, font/fill/alignment style mapping, and merged-cell tagging (lines 132-199). All of this executes in one blocking pass before `setSheetData` is called.

For a large workbook the nested `eachRow`/`eachCell` loop with per-cell object construction blocks the main thread for the full duration — no yielding — freezing scroll, clicks, and the loading skeleton animation. Supabase Storage allows files up to 50 MB (per CLAUDE.md), so a genuinely large spreadsheet can lock the tab for seconds.

Mitigating factors: it runs **once per file** (the effect deps are `[fileUrl]`), not per render, and the component is **already `next/dynamic`** — `DocumentViewer.tsx:16` lazy-loads it with `ssr: false`, so the ~exceljs + fortune-sheet bundle isn't in the initial payload. Good. The remaining problem is purely the main-thread stall during parse.

## Fix

Move the parse + normalize work off the main thread. Preferred: a dedicated web worker.

- Create a worker (e.g. `src/components/review/spreadsheet.worker.ts`) that imports `exceljs`, receives the fetched `ArrayBuffer`, runs the exact same transform currently in lines 80-227, and `postMessage`s the normalized `FortuneSheetData[]` back.
- In the component, keep the fetch on the main thread (or move it into the worker too), then hand the `ArrayBuffer` to the worker via `postMessage` (transfer the buffer to avoid a copy). On the worker's `message`, `setSheetData(...)` as today. Preserve the `cancelled` guard by terminating the worker in the effect cleanup.
- Instantiate with the standard bundler pattern: `new Worker(new URL("./spreadsheet.worker.ts", import.meta.url))`. Note `next.config.ts` already sets `worker-src 'self' blob:` in the CSP (line 91), so worker instantiation is allowed.

Fallback if a worker proves awkward with the exceljs bundle: chunk-and-yield on the main thread — batch `eachRow` processing (e.g. 500 rows per slice) and `await` a `scheduler.yield()` / `setTimeout(0)` between slices so the browser can paint and handle input. This reduces the freeze but doesn't eliminate main-thread cost the way a worker does.

Keep the output shape identical (`FortuneSheetData[]` with `celldata`, `config.columnlen/rowlen/merge`, etc.) so `<Workbook>` renders exactly as before.

## Verification

- Load a large (multi-MB, thousands-of-rows) spreadsheet: the tab stays interactive during parse (scroll/click responsive, skeleton keeps animating). Confirm via a Performance-panel trace that the long main-thread task is gone (work now shows on the worker thread).
- Diff the rendered grid against the current implementation for a fixture workbook covering merged cells, column widths, row heights, bold/italic/colored cells, and number/date formats — output must be pixel-identical.
- Error path still works: a failed fetch or parse still surfaces `"Failed to load spreadsheet."` and the worker is terminated.
- `npm run check` and tests pass.

## Risks / notes

- Effort **M**: worker plumbing under the Next/Turbopack bundler, transferable-buffer handling, and lifecycle (terminate on unmount / `fileUrl` change) all need care. Not a one-liner.
- `exceljs` must run cleanly in a worker context (no DOM APIs used in the transform — it doesn't, it only reads workbook data), so this should be safe.
- CSP already permits workers (`worker-src 'self' blob:` in `next.config.ts:91`) — no infra change needed.
- Verify the transferred `ArrayBuffer` isn't reused on the main thread after transfer (it becomes detached).
