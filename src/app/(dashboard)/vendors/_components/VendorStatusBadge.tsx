"use client";

import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { VendorStatus } from "@/types";

const STATUS_VARIANT: Record<VendorStatus, BadgeVariant> = {
  active: "active",
  inactive: "archived",
  blacklisted: "error",
  pending_approval: "warning",
};

interface Props {
  status: VendorStatus;
  className?: string;
}

/** Coloured pill for a vendor's lifecycle status. */
export function VendorStatusBadge({ status, className }: Props) {
  const t = useTranslations("vendors");
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {t(`status_${status}`)}
    </Badge>
  );
}
