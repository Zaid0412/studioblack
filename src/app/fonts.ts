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
 */
export const satoshi = localFont({
  src: [
    { path: "./fonts/satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/satoshi-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const cabinetGrotesk = localFont({
  src: [
    {
      path: "./fonts/cabinet-grotesk-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/cabinet-grotesk-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/cabinet-grotesk-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/cabinet-grotesk-800.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-cabinet-grotesk",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
