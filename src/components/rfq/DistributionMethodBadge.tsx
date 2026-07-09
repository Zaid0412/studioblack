"use client";

import { useTranslations } from "next-intl";
import type { RfqDistributionMethod } from "@/lib/validations";
import {
  DISTRIBUTION_METHOD_LABELS,
  DISTRIBUTION_METHOD_ICONS,
} from "@/lib/rfqLabels";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/**
 * Small chip showing how an RFQ reached a vendor (§11). Unlike
 * `ResponseSourceBadge`, `portal` is shown — a portal-only invite (the vendor
 * has no receives_rfq contact) is meaningful distribution info, not a hidden
 * default. `mixed` = reached through more than one channel.
 *
 * Wrapped in a tooltip since the label+icon alone don't explain what each
 * channel means (e.g. "Portal" doesn't say "no email was sent").
 */
export function DistributionMethodBadge({
  method,
}: {
  method: RfqDistributionMethod;
}) {
  const t = useTranslations("rfq.distribution");
  const Icon = DISTRIBUTION_METHOD_ICONS[method];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted cursor-default">
          <Icon className="w-3 h-3" />
          {DISTRIBUTION_METHOD_LABELS[method]}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t(`${method}Tooltip`)}</TooltipContent>
    </Tooltip>
  );
}
