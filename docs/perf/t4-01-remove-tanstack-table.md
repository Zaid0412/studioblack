# Remove unused `@tanstack/react-table` dependency

- **Tier / Impact / Effort:** T4 · Low · S
- **Area:** bundle
- **Files:** `package.json:46`, `docs/boq-implementation-plan.md:1005`, `docs/boq-implementation-plan.md:1039`, `src/app/(dashboard)/projects/[id]/boq/_components/BoqTable.tsx`

## Problem

`package.json:46` declares `"@tanstack/react-table": "^8.21.3"`, but nothing in `src` imports it. A grep for `useReactTable` and `from "@tanstack/react-table"` returns zero hits — the only references are in `docs/boq-implementation-plan.md` (lines 1005 and 1039) and the lockfile.

It was planned as the virtualization layer for a 1000+ row BOQ table (`docs/boq-implementation-plan.md:1005` — "virtualised table for 1000+ rows"; line 1039 lists it under "add to package.json"), but was never wired up. The actual `BoqTable.tsx` (1094 lines) renders a plain grouped table via `.map()` over sections/items with `@dnd-kit` sortable rows — no windowing, no `useReactTable`. So the dependency is dead weight: install time, `npm audit` surface, and Dependabot noise for a package that ships no code.

## Fix

Recommended: remove it now.

```
npm uninstall @tanstack/react-table
```

This deletes the entry from `package.json:46` and prunes the lockfile. No source change is needed because nothing imports it.

Optionally add a one-line note to `docs/boq-implementation-plan.md` near line 1005 that the dependency was removed and virtualization is deferred to a separate effort, so the doc doesn't imply the package is still present.

Alternative (not recommended now): actually adopt it to virtualize `BoqTable.tsx` — the original motivation. Only worth it if real BOQs exceed ~1000 line items; today there's no evidence they do. Cross-reference the t1-05 memoization fix and the "BOQ table has no windowing" finding — virtualization is the correct long-term answer for very large BOQs, but it's a standalone piece of work with its own testing burden (drag-and-drop reordering must keep working under a virtualized row window), not a byproduct of this cleanup.

## Verification

- `npm run check` (lint + format + tsc) passes.
- `npm test` and `npm run test:hooks` pass — no test imports the package.
- App builds and runs; BOQ table renders identically (no runtime change — the dep was never loaded).

## Risks / notes

- Effectively zero risk: removing an unimported dependency cannot change runtime behavior.
- If virtualization is later adopted, re-add the dep as part of that dedicated effort rather than keeping it installed unused in the meantime.
- Coordinate with t4-02: if this dep is removed, drop `@tanstack/react-table` from the `optimizePackageImports` list proposed there.
