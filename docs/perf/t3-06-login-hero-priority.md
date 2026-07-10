# Mark the login-hero logo as `priority` (LCP)

- **Tier / Impact / Effort:** T3 · Low-Med · S
- **Area:** rendering
- **Files:** `src/components/ui/BrandLogo.tsx:36,48-55` (add `priority` prop, pass to `<Image>`), `src/app/(auth)/_components/AuthPageLayout.tsx:57` (`<BrandLogo size="lg" />` in the hero panel)

## Problem

`BrandLogo` renders via `next/image` (`BrandLogo.tsx:48-55`) but never sets `priority`. At `size="lg"` the no-text variant is 144×144 (`sizeMap.lg.noTextPx`), used in the auth hero panel (`AuthPageLayout.tsx:57`) — the largest above-the-fold image on the login page and the likely LCP element. Without `priority`, `next/image` lazy-loads it (default `loading="lazy"`, low fetch priority), so it's discovered and fetched late, delaying LCP.

## Fix

Add an optional `priority` prop to `BrandLogo` and thread it to the `<Image>`:

```tsx
export function BrandLogo({
  size = "md",
  priority = false,
}: { size?: "sm" | "md" | "lg"; priority?: boolean }) {
  ...
  return logoSrc ? (
    <Image
      src={logoSrc}
      alt={branding.appName}
      width={imgSize}
      height={imgSize}
      priority={priority}
      className={`${dims} ${rounded} object-contain`}
    />
  ) : ( ... );
}
```

Pass `priority` **only** at the auth hero call site (`AuthPageLayout.tsx:57`):

```tsx
<BrandLogo size="lg" priority />
```

Leave all other `BrandLogo` usages (headers, compact contexts) at the default `false` — they're not LCP and eager-loading them would compete for bandwidth.

## Verification

- Lighthouse on the login route: LCP improves; the logo is no longer flagged as a lazy-loaded LCP element ("Largest Contentful Paint element was lazily loaded").
- Network panel: the hero logo request shows high fetch priority and starts early in the waterfall.
- Other `BrandLogo` instances still lazy-load (unchanged) — confirm no regression in initial JS/bandwidth elsewhere.

## Risks / notes

- `priority` implies `loading="eager"` + `fetchpriority="high"` and suppresses the lazy default; apply narrowly to the single LCP image only. Over-applying `priority` across many logos would hurt, not help.
- `next/image` warns if `priority` is set on an off-screen image — only the hero (above the fold) gets it, so no warning.
- Pure additive prop; default `false` keeps every existing call site behaviourally identical.
