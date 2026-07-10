# Add `experimental.optimizePackageImports` for dnd-kit

- **Tier / Impact / Effort:** T4 · Low · S
- **Area:** bundle
- **Files:** `next.config.ts:19` (top of `nextConfig` object), `package.json:28`, `package.json:29`

## Problem

`next.config.ts` has no `experimental.optimizePackageImports` entry — the `nextConfig` object (starting line 19) defines `serverExternalPackages`, `skipTrailingSlashRedirect`, `rewrites`, `redirects`, `images`, and `headers`, but no `experimental` block at all.

Next 16 already ships a large default `optimizePackageImports` list that covers `lucide-react`, `date-fns`, and most `@radix-ui/*` packages, so those need no manual entry (adding them is redundant). What is **not** in the default list and is used in `src`:

- `@dnd-kit/core` (`package.json:28`)
- `@dnd-kit/sortable` (`package.json:29`)
- `@tanstack/react-table` (`package.json:46`) — but see t4-01, which removes it.

`optimizePackageImports` rewrites barrel imports to direct submodule paths so only the used members are pulled into the chunk. For dnd-kit this is a modest win — these are behavior libraries, not icon-sized barrels like `lucide-react`, so the savings are small.

## Fix

Add an `experimental` block at the top of the `nextConfig` object in `next.config.ts` (around line 19, alongside `serverExternalPackages`):

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    optimizePackageImports: ["@dnd-kit/core", "@dnd-kit/sortable"],
  },
  // ...existing rewrites/redirects/images/headers
};
```

Do **not** add `lucide-react`, `date-fns`, or `@radix-ui/*` — they're already in Next 16's default list. Do **not** add `@tanstack/react-table` if t4-01 removes it (otherwise `optimizePackageImports` would reference a non-existent dependency).

## Verification

- `next build` succeeds with the new config.
- Run `@next/bundle-analyzer` (or `ANALYZE=1 next build` if wired) before and after; the dnd-kit-consuming chunks (e.g. the BOQ route) should be equal or slightly smaller. Expect a small delta — flag if a chunk grows.
- Smoke-test drag-and-drop in the BOQ table and any other dnd-kit surface to confirm the rewritten imports resolve correctly.

## Risks / notes

- Low impact by itself — best bundled with other bundle work (e.g. done in the same PR as t4-01) rather than as a standalone change.
- `optimizePackageImports` is an `experimental` key; it's stable and widely used in Next 15/16, but pin awareness on Next upgrades in case the option graduates or is renamed.
