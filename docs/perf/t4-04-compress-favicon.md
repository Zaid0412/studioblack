# Compress oversized favicon (`icon.png`)

- **Tier / Impact / Effort:** T4 · Low · S
- **Area:** assets
- **Files:** `src/app/icon.png`, `src/app/apple-icon.png`

## Problem

`src/app/icon.png` is **44,919 bytes (~45 KB)** and encoded at **512×512** RGBA. Next's file-based metadata convention injects `icon.png` as a `<link rel="icon">` referenced in the `<head>` of every page, so this asset is fetched on first load site-wide. A 512×512 source is far larger than a favicon needs — browsers render it at 16–48 px. Typical optimized favicons are a few KB.

`src/app/apple-icon.png` is **11,390 bytes (~11.4 KB)** at **180×180**, which is the correct apple-touch-icon dimension and a reasonable size — leave it as-is (listed only for context/comparison).

## Fix

Re-export `icon.png` at an appropriate favicon resolution and run it through PNG optimization. Purely an asset swap — no code change, and no change to `next.config.ts` or any component.

Options (pick one):

- Export at **48×48** (or 32×32), 8-bit palette or optimized RGBA, then run `oxipng -o max icon.png` / `pngquant` / `zopflipng`. This alone should drop it into the low single-digit KB range.
- If crispness at higher DPI matters, keep 96×96 or 128×128 but still optimize — even at 128×128 an optimized PNG is typically <5 KB.

Keep the filename and location (`src/app/icon.png`) so Next's metadata routing continues to pick it up automatically. Do not add a manual `<link>` or `metadata.icons` entry — the file convention already handles it.

## Verification

- Favicon still renders in the browser tab (light and dark) after the swap.
- `stat -c %s src/app/icon.png` shows a substantially smaller file (target: low single-digit KB, down from ~45 KB).
- `next build` succeeds and the generated `<head>` still links the icon.

## Risks / notes

- No code change; the only risk is a visibly lower-quality icon if downscaled too aggressively — verify at 16 px and on a HiDPI display before committing.
- Regenerate from the highest-quality source available (ideally the original vector/logo) rather than upscaling, to avoid artifacts.
