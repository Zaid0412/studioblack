# Self-host fonts via `next/font/local` (drop render-blocking Fontshare)

- **Tier / Impact / Effort:** T2 · High · M
- **Area:** assets
- **Files:** `src/app/layout.tsx:36-46` (Fontshare `<link>`s), `src/app/globals.css:41-43` (`--font-sans` / heading stack referencing `"Satoshi"` / `"Cabinet Grotesk"`), `next.config.ts:87` (`style-src … https://api.fontshare.com`), `next.config.ts:89` (`font-src 'self' https://cdn.fontshare.com`)

## Problem

`src/app/layout.tsx:37-46` loads fonts from Fontshare:
- `preconnect` to `api.fontshare.com` and `cdn.fontshare.com`, then
- a **render-blocking** `<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&f[]=cabinet-grotesk@400,500,700,800&display=swap">`.

That stylesheet is a cross-origin request in the critical path of **every** page (including
login), adding a DNS+TLS+RTT before the browser even discovers the up-to-9 `.woff2` files it
pulls from `cdn.fontshare.com` (Satoshi 300/400/500/600/700 + Cabinet Grotesk 400/500/700/800).
`display=swap` avoids FOIT but the fallback metrics are unmatched, so there's FOUT/CLS as the
web fonts swap in. All of this competes with FCP.

## Fix

Migrate to `next/font/local` (self-hosted, no render-blocking request, auto-injected
`size-adjust` / `font-display` to cut CLS):

1. **Audit which weights are actually used** before downloading everything. Grep the codebase
   for `font-weight` / Tailwind weight classes (`font-light` 300, `font-normal` 400,
   `font-medium` 500, `font-semibold` 600, `font-bold` 700, `font-extrabold` 800) and inspect
   `globals.css`. Only download the `.woff2` weights in use — dropping unused weights is free
   payload savings. `--font-sans` is Satoshi (body), the heading stack is Cabinet Grotesk
   (`globals.css:41-43`).
2. Download the required `.woff2` files (from the Fontshare licenses already in use) into the
   repo, e.g. `src/app/fonts/`.
3. Define them with `next/font/local` in a server module (e.g. in `layout.tsx` or a small
   `src/app/fonts.ts`), one `localFont({ src: [...weights...], variable: "--font-satoshi",
   display: "swap" })` per family, and apply the generated CSS variable classes to `<html>`
   (or `<body>`). Point `globals.css:41-43` `--font-sans` / heading stack at those variables
   (`var(--font-satoshi)` etc.) instead of the bare `"Satoshi"` / `"Cabinet Grotesk"` names.
4. Remove the three `<link>` tags and both `preconnect`s from `layout.tsx:37-46`.
5. Remove Fontshare from the CSP in `next.config.ts`: drop `https://api.fontshare.com` from
   `style-src` (`next.config.ts:87`) and `https://cdn.fontshare.com` from `font-src`
   (`next.config.ts:89`). `next/font/local` self-hosts under the app origin, so `'self'`
   covers it — no external font/style origins remain.

## Verification

- DevTools Network panel on a cold load of `/login` and a dashboard route: **zero** requests
  to `api.fontshare.com` / `cdn.fontshare.com`; fonts served from the app origin.
- Both families render correctly across the app — spot-check body text (Satoshi) and headings
  (Cabinet Grotesk) in light + dark, and confirm every weight actually used still resolves
  (no silent fallback to system font where a dropped weight was needed).
- CLS: Lighthouse / web-vitals shows reduced layout shift vs. baseline (self-host + injected
  `size-adjust`).
- CSP not broken: load with the new headers, confirm no CSP violations in console for
  styles/fonts.
- `npm run check` (build succeeds with `next/font` wired in).

## Risks / notes

- **Licensing**: confirm the Fontshare license permits self-hosting the `.woff2` files. If
  not, keep `cdn.fontshare.com` but at minimum preload the specific `.woff2` files and drop
  the render-blocking CSS `<link>`. (Fontshare fonts are generally free for commercial use,
  but verify.)
- Getting the weight audit right matters — shipping all 9 weights self-hosted could be *more*
  bytes than needed. Trim to actual usage.
- Keep `display: "swap"` to preserve the current no-FOIT behavior; `next/font`'s metric
  overrides handle the CLS side.
- `--font-sans` is also consumed by Tailwind v4 theme tokens in `globals.css` — make sure the
  variable indirection still flows through the theme (`@theme` / CSS-var usage) after the swap.
