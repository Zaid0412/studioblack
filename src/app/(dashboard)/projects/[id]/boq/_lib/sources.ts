import type { BadgeVariant } from "@/components/ui/badge";
import type { BoqItemSource } from "@/lib/validations";

/**
 * Display metadata for the four BOQ row sources. Single source of truth for
 * the badge variant and i18n key — consumed by both `BoqSourceBadge` (per-row
 * column) and `BoqSourceFilter` (filter chip strip), so they can't drift.
 */
export const SOURCE_DISPLAY: Record<
  BoqItemSource,
  { variant: BadgeVariant; i18nKey: string }
> = {
  custom: { variant: "draft", i18nKey: "sourceCustom" },
  library: { variant: "info", i18nKey: "sourceLibrary" },
  project: { variant: "submitted", i18nKey: "sourceProject" },
  rate_contract: { variant: "success", i18nKey: "sourceRateContract" },
};
