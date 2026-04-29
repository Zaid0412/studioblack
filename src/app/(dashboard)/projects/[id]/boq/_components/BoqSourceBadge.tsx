"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { BoqItemSource } from "@/lib/validations";
import { SOURCE_DISPLAY } from "../_lib/sources";

interface BoqSourceBadgeProps {
  source: BoqItemSource;
}

/** Single small pill labelling a BOQ row's provenance. Read-only. */
export function BoqSourceBadge({ source }: BoqSourceBadgeProps) {
  const t = useTranslations("boq.table");
  const { variant, i18nKey } = SOURCE_DISPLAY[source];
  return (
    <Badge
      variant={variant}
      className="!px-2 !py-0.5 !text-[10px] truncate max-w-full"
    >
      {t(i18nKey)}
    </Badge>
  );
}
