# Convert sidebar logo + Avatar to `next/image`

- **Tier / Impact / Effort:** T3 · Med · M
- **Area:** assets
- **Files:** `src/components/layout/sidebar.tsx:179-192` (raw `<img>` logo), `src/components/ui/avatar.tsx:35-43` (raw `<img>` avatar); reference `src/components/ui/BrandLogo.tsx` (already next/image), `next.config.ts:67-70` (remotePatterns)

## Problem

CLAUDE.md mandates `next/image` for static/known-dimension images (WebP conversion, resize, lazy loading, CLS-free). Two hot paths still use raw `<img>` with an eslint-disable:

- **Sidebar branding logo** (`sidebar.tsx:181`): renders `logoSrc` (`/logo.png` ~18KB or `/logo-dark.png`) with no `width`/`height`, sized only by Tailwind classes (`h-8 w-8` … `h-24 w-24`). Full-size PNG served, downscaled by CSS. The `eslint-disable @next/next/no-img-element` is unjustified — `BrandLogo.tsx` and `SplashScreen.tsx` already prove `next/image` works for these local logos.
- **Avatar** (`avatar.tsx:38`): renders **remote** avatar URLs (`lh3.googleusercontent.com`, `*.supabase.co` — both already whitelisted in `next.config.ts:67-70` `remotePatterns`) with no dimensions, full-size source downscaled by CSS. This is the **highest-volume image path** — member/task lists and tables render many avatars per page, each a full-resolution download.

## Fix

**Avatar (`avatar.tsx`).** The size→pixel map is implicit in `sizeStyles` (Tailwind `w-*`). Add an explicit numeric px map so `next/image` gets real dimensions:

```tsx
import Image from "next/image";

const sizePx: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 44,
  xl: 64, // matches w-5/w-7/w-9/w-11/w-16
};
```

In the `src` branch, replace `<img>` with:

```tsx
<Image
  src={src}
  alt={initials}
  width={sizePx[size]}
  height={sizePx[size]}
  sizes={`${sizePx[size]}px`}
  className={cn("rounded-full object-cover", sizeStyles[size], className)}
/>
```

Remove the `eslint-disable`. Keep the initials-fallback branch untouched.

**Sidebar (`sidebar.tsx`).** The logo has three size states (with-text `h-8 w-8`, collapsed `h-14 w-14`, expanded `h-24 w-24` = 32/56/96px). Pass the largest rendered px as `width`/`height` (96) and let the existing className drive display size, or compute px from the same branching used for the className. Replace the `<img>` with `next/image`, keep the `object-contain transition-all` classes, and drop the `eslint-disable`. Since `logoSrc` is a local `/public` asset, no remotePatterns entry is needed.

## Verification

- Logo renders at all three sidebar states (with-text, collapsed, expanded) and Avatar at all five sizes (xs–xl); no visual regression.
- Network panel: avatar/logo transfers are WebP and resized (smaller bytes than the raw PNG/source).
- No layout shift (CLS) on load — explicit width/height reserve space.
- `npm run check` passes with the `eslint-disable` lines removed (no `@next/next/no-img-element` warning).

## Risks / notes

- Avatar `object-cover` + fixed square width/height preserves the current crop behaviour for non-square sources.
- Remote avatar hosts are already whitelisted (`next.config.ts:67-70`); no config change. If a new avatar host appears later it must be added there or `next/image` will 400.
- `next/image` requires both `width` and `height` for non-`fill` usage — the px maps supply them; keep them in sync with `sizeStyles` / the sidebar className breakpoints.
