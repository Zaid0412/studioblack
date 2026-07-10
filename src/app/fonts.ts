import localFont from "next/font/local";

/**
 * Self-hosted fonts (replaces the render-blocking Fontshare stylesheet).
 * `next/font/local` inlines the font-face rules, injects `size-adjust` metric
 * overrides to cut CLS, and serves the `.woff2` from the app origin — no
 * cross-origin DNS+TLS+RTT on the critical path.
 *
 * Weights mirror what Fontshare actually served: Satoshi ships no 600 file, so
 * `font-semibold` renders via the browser's weight synthesis exactly as before.
 * Satoshi 300 (light) is dropped — unused (`font-light` has zero call sites).
 * `style` defaults to "normal", so it's omitted per face.
 *
 * NB: `next/font/local` statically analyzes these calls at build time — every
 * option must be an inline literal (no shared `const` for `fallback`, etc.).
 */
export const satoshi = localFont({
  src: [
    { path: "./fonts/satoshi-400.woff2", weight: "400" },
    { path: "./fonts/satoshi-500.woff2", weight: "500" },
    { path: "./fonts/satoshi-700.woff2", weight: "700" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const cabinetGrotesk = localFont({
  src: [
    { path: "./fonts/cabinet-grotesk-400.woff2", weight: "400" },
    { path: "./fonts/cabinet-grotesk-500.woff2", weight: "500" },
    { path: "./fonts/cabinet-grotesk-700.woff2", weight: "700" },
    { path: "./fonts/cabinet-grotesk-800.woff2", weight: "800" },
  ],
  variable: "--font-cabinet-grotesk",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
