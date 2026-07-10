import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withPostHogConfig } from "@posthog/nextjs-config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
// PostHog Cloud serves assets from a separate hyphenated subdomain
// (eu-assets / us-assets). Custom-domain users can override via
// NEXT_PUBLIC_POSTHOG_ASSETS_HOST.
const POSTHOG_ASSETS_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_ASSETS_HOST ||
  POSTHOG_HOST.replace(
    /https:\/\/(eu|us)\.i\.posthog\.com/,
    "https://$1-assets.i.posthog.com"
  );

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // CI already runs `tsc --noEmit` on every push (lint.yml), and prod only
  // deploys from `main` (which passed CI), so re-type-checking during the
  // Vercel build is redundant — skipping it cuts ~30s off every build.
  // (Next 16 no longer runs ESLint during build, so nothing to skip there.)
  typescript: { ignoreBuildErrors: true },
  // PostHog reverse proxy: route SDK traffic through our own domain so
  // ad-blockers don't drop ingestion / replay requests.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${POSTHOG_ASSETS_HOST}/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${POSTHOG_HOST}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/client-dashboard",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/client-dashboard/:path*",
        destination: "/:path*",
        permanent: true,
      },
      // RFQ moved from BOQ to Order. Keep old vendor email deep links alive.
      // `:rest*` (zero-or-more) also matches the bare `/boq/rfq`.
      {
        source: "/projects/:id/boq/rfq/:rest*",
        destination: "/projects/:id/order/rfq/:rest*",
        permanent: true,
      },
      // Category management moved from a settings sub-page to a top-level
      // route. Keep old bookmarks/deep links (incl. `?from=` variants) working.
      // Non-permanent (307) so browsers don't hard-cache it — the move is
      // recent and this stays cheap to revise.
      {
        source: "/settings/element-categories",
        destination: "/categories",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { hostname: "studio-black.co.in" },
      { hostname: "*.supabase.co", protocol: "https" as const },
      { protocol: "https" as const, hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "0" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${POSTHOG_ASSETS_HOST}`,
              "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
              "font-src 'self' https://cdn.fontshare.com",
              `connect-src 'self' https://*.supabase.co ${POSTHOG_HOST} ${POSTHOG_ASSETS_HOST}`,
              "worker-src 'self' blob:",
              // Allow `blob:` iframes so `FilePreview` can render PDFs via a
              // client-side object URL (Supabase serves PDFs with
              // `X-Frame-Options: DENY`, so we fetch + blob the bytes on
              // the client and iframe the same-origin blob URL).
              "frame-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const intlConfig = withNextIntl(nextConfig);

// Upload source maps to PostHog only on PRODUCTION Vercel builds. Staging and
// PR previews don't need error-tracking maps, and skipping the upload (+ its
// scan of ~900 map files) saves ~30s/build. Local builds skip it too (no
// VERCEL_ENV / creds).
export default process.env.VERCEL_ENV === "production" &&
process.env.POSTHOG_API_KEY &&
process.env.POSTHOG_PROJECT_ID
  ? withPostHogConfig(intlConfig, {
      personalApiKey: process.env.POSTHOG_API_KEY,
      projectId: process.env.POSTHOG_PROJECT_ID,
      host: POSTHOG_HOST,
      sourcemaps: {
        enabled: true,
        releaseName: "studioblack",
        deleteAfterUpload: true,
      },
    })
  : intlConfig;
