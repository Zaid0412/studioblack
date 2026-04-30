/**
 * Build-time feature flags for conditionally enabling sections and routes.
 *
 * Runtime flags (UI gates that should be flippable without a deploy) live
 * in PostHog — see `useFeatureFlagEnabled("…")`. The flags below stay here
 * because they're read at module load (e.g. better-auth config in
 * `src/lib/auth.ts`) or because we never expect to toggle them at runtime.
 */
export const features = {
  magicLink: false,
  teamManagement: true,
  auditHistory: true,
  clientPortal: true,
  notifications: true,
  designUpload: true,
  emailVerification: true,
} as const;
