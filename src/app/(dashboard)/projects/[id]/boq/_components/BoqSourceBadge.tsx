"use client";

import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { BoqItemSource } from "@/lib/validations";

interface BoqSourceBadgeProps {
  source: BoqItemSource;
}

const VARIANT_BY_SOURCE: Record<BoqItemSource, BadgeVariant> = {
  custom: "draft",
  library: "info",
  project: "submitted",
  rate_contract: "success",
};

const I18N_KEY_BY_SOURCE: Record<BoqItemSource, string> = {
  custom: "sourceCustom",
  library: "sourceLibrary",
  project: "sourceProject",
  rate_contract: "sourceRateContract",
};

/** Single small pill labelling a BOQ row's provenance. Read-only. */
export function BoqSourceBadge({ source }: BoqSourceBadgeProps) {
  const t = useTranslations("boq.table");
  return (
    <Badge
      variant={VARIANT_BY_SOURCE[source]}
      className="!px-2 !py-0.5 !text-[10px] truncate max-w-full"
    >
      {t(I18N_KEY_BY_SOURCE[source])}
    </Badge>
  );
}
