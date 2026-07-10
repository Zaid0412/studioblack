"use client";

import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  responded: number;
  total: number;
  /** `"count"` = `n/m` in a tooltip (list rows); `"pill"` = full-sentence badge. */
  variant?: "count" | "pill";
}

/**
 * Derived §9 "responded vs partially-responded" indicator. Owns the
 * all-vs-partial threshold + i18n so the two surfaces (RFQ list, comparison
 * page) can't drift — each caller computes `{responded, total}` from its own
 * source (a list-query aggregate vs the comparison payload) and renders this.
 */
export function RespondedChip({ responded, total, variant = "count" }: Props) {
  const t = useTranslations("rfq");
  const all = responded >= total;
  const label = all
    ? t("responded.all", { total })
    : t("responded.partial", { responded, total });

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          all ? "bg-success/10 text-success" : "bg-bg-secondary text-text-muted"
        }`}
      >
        {label}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={all ? "text-success" : undefined}>
          {responded}/{total}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
