import { useFeatureFlagEnabled } from "posthog-js/react";

/**
 * Single source of truth for runtime feature flags evaluated via PostHog.
 *
 * The fallback applies when PostHog hasn't responded yet (first load) or
 * when it's unreachable. Match each entry to the rollout configured in
 * PostHog so both layers stay in sync.
 */
const FLAG_FALLBACKS = {
  elementLibrary: true,
  boq: true,
  vendorManagement: true,
  rateContracts: true,
  vendorPortal: false,
  designDocumentControl: false,
  overviewTab: true,
} as const;

export type FlagKey = keyof typeof FLAG_FALLBACKS;

/** Typed PostHog flag check with hardcoded fallback per flag. */
export function useFlag(key: FlagKey): boolean {
  return useFeatureFlagEnabled(key) ?? FLAG_FALLBACKS[key];
}
