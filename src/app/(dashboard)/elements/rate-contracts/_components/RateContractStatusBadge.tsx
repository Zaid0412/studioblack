"use client";

import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { RateContractStatus } from "@/types";

const STATUS_VARIANT: Record<RateContractStatus, BadgeVariant> = {
  draft: "draft",
  active: "active",
  expired: "warning",
  cancelled: "archived",
};

interface Props {
  status: RateContractStatus;
  className?: string;
}

/** Coloured pill for a rate contract's lifecycle status. */
export function RateContractStatusBadge({ status, className }: Props) {
  const t = useTranslations("rateContracts");
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {t(`status_${status}`)}
    </Badge>
  );
}
