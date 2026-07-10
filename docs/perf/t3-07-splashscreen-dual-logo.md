# SplashScreen: stop eagerly fetching both logo variants

- **Tier / Impact / Effort:** T3 · Low-Med · S
- **Area:** rendering
- **Files:** `src/components/SplashScreen.tsx:42-57` (two `<Image priority>` elements, CSS hides the wrong one), CSS classes `splash-logo-dark` / `splash-logo-light` in `src/app/globals.css`

## Problem

`SplashScreen` renders **both** logo variants — `branding.logoUrl` and `branding.logoUrlDark` — each with `priority` (`SplashScreen.tsx:42-57`). CSS (`splash-logo-dark` / `splash-logo-light`, keyed off `data-theme`) hides the wrong one, but `display:none` does not stop the fetch: the browser eagerly, at **high priority** (`priority` → `fetchpriority="high"`), downloads both PNGs (~18KB each). One is always thrown away, and both compete for bandwidth with the real LCP during the critical initial-load window — the splash is a full-screen overlay shown exactly when the app is trying to paint.

The correct theme is already known **before hydration**: `ThemeProvider`'s blocking `<script>` in `<head>` stamps `data-theme` on the root (per the component's own comment, `SplashScreen.tsx:39-41`), so the active variant is determinable at first paint.

## Fix

Render only the active variant. Two options, lowest-risk first:

**Option A (keep both in DOM, prioritize only the visible one).** Drop `priority` from the hidden variant so only one high-priority fetch happens. But `display:none` may still trigger a (low-priority) fetch of the hidden image, so this only _demotes_, doesn't eliminate, the waste.

**Option B (preferred — render one).** Since `data-theme` is set pre-hydration, read it and render a single `<Image priority>`. The blocking theme script runs before this client component mounts; on mount, read `document.documentElement.dataset.theme` in a `useState` initializer (guarded for SSR) and pick the matching `logoUrl` / `logoUrlDark`. Render one `<Image>` with `priority`. This removes the wasted fetch entirely and keeps the single real logo at high priority.

```tsx
const isDark =
  typeof document !== "undefined" &&
  document.documentElement.dataset.theme === "dark";
const src = isDark
  ? branding.logoUrl
  : (branding.logoUrlDark ?? branding.logoUrl);
```

(Mirror the light/dark→`logoUrl` mapping already used in `BrandLogo.tsx:43-46` and `sidebar.tsx:76-79` so the variant selection stays consistent across the three call sites.) Drop the `splash-logo-dark` / `splash-logo-light` toggle classes for this element once a single image is rendered.

## Verification

- Network panel on cold load: exactly **one** logo request fires (not two), at high priority.
- Correct logo shows in both light and dark themes (toggle `data-theme`, reload) — no flash of the wrong variant, since selection uses the pre-hydration `data-theme`.
- No visual/animation regression (dots, fade-out) — only the logo element changes.

## Risks / notes

- Confirm the light/dark→variant mapping matches the other two call sites (`BrandLogo`, `sidebar`) — they use `mode === "dark" ? logoUrl : logoUrlDark`. Keep the splash consistent to avoid a theme-mismatched logo.
- Option B reads `document` at mount — guard for SSR (`typeof document !== "undefined"`); the component is already `"use client"`, and the theme script has run by mount time.
- If keeping both variants is preferred for simplicity, Option A (remove `priority` from the hidden one) still cuts the high-priority double-fetch, which is the main harm.
