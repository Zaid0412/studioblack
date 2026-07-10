# Defer pdfjs-dist to runtime (only load it for PDFs)

- **Tier / Impact / Effort:** T1 · High · S
- **Area:** bundle
- **Files:** `src/components/review/DocumentViewer.tsx:11,24,62,72-79,97-133`

## Problem

`src/components/review/DocumentViewer.tsx:11` does `import * as pdfjsLib from "pdfjs-dist"` at module scope, and line 24 sets `pdfjsLib.GlobalWorkerOptions.workerSrc` at import time. `DocumentViewer` is statically imported by the review page, so pdfjs-dist (~350KB+ minified) ships in that route's bundle for **every** review file — even though it's only used inside `loadPdf()` (line 75, `pdfjsLib.getDocument`) and the page render loop (line 122, `page.render`), all gated on `isPdf(fileName)` (line 66). Reviewing an image or spreadsheet still pays the full pdfjs download.

## Fix

1. Remove the top-level `import * as pdfjsLib` (line 11) and the module-scope `workerSrc` assignment (line 24). Keep a lazily-populated module-level ref so both effects share one instance:

```ts
// top of module (no static pdfjs import)
type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}
```

2. In `loadPdf()` (line 72), await the module before use:

```ts
async function loadPdf() {
  setPdfLoading(true);
  try {
    const pdfjsLib = await loadPdfjs();
    const doc = await pdfjsLib.getDocument(proxyUrl).promise;
    if (cancelled) return;
    pdfDocRef.current = doc;
    setNumPages(doc.numPages);
  } // ...catch/finally unchanged
}
```

3. Fix the type-only references so they don't force a static import: `pdfDocRef` (line 62, `pdfjsLib.PDFDocumentProxy`) becomes `useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null)` — a type import erases at compile time and does not pull the module into the bundle. The render loop (line 97-133) uses `pdfDocRef.current` (already an instance), so no further module access is needed there.

4. **Alternative** (simpler, coarser): keep the code as-is and `next/dynamic` the whole `DocumentViewer` from its parent with `ssr: false`. This defers pdfjs plus the viewer chunk but also defers the image/spreadsheet paths — acceptable since the viewer is below the fold on the review page. Prefer option (1)-(3) if image review must stay instant.

## Verification

- Bundle analyzer: `pdfjs-dist` moves out of the review route's initial chunk into a lazily-loaded chunk.
- Manual: open a review with a non-PDF file (image/spreadsheet), confirm via network tab that neither pdfjs nor `/pdf.worker.min.mjs` is requested. Open a PDF review, confirm pages render and pin-mode clicks still work.
- `npm run check` green (verify the `import("pdfjs-dist").PDFDocumentProxy` type ref resolves).

## Risks / notes

- The worker (`/pdf.worker.min.mjs`) is a public static asset; deferring `workerSrc` assignment into `loadPdfjs()` is safe because it runs before `getDocument`.
- First PDF open now has a one-time module-fetch latency; the existing `pdfLoading` skeleton (line 192-196) already covers it.
- `PIN_CURSOR` (line 27-31) and the rest of the component are unaffected — they don't touch pdfjs.
