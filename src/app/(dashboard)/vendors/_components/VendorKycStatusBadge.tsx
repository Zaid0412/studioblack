"use client";

import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { VendorKycStatus } from "@/types";

const KYC_VARIANT: Record<VendorKycStatus, BadgeVariant> = {
  unverified: "archived",
  pending: "warning",
  verified: "success",
  rejected: "error",
};

interface Props {
  status: VendorKycStatus;
  className?: string;
}

/** Coloured pill for a vendor's KYC verification state. */
export function VendorKycStatusBadge({ status, className }: Props) {
  const t = useTranslations("vendors");
  return (
    <Badge variant={KYC_VARIANT[status]} className={className}>
      {t(`kycStatus_${status}`)}
    </Badge>
  );
}

const DOT_COLOR: Record<VendorKycStatus, string> = {
  unverified: "bg-text-muted",
  pending: "bg-warning",
  verified: "bg-success",
  rejected: "bg-error",
};

/** 8-px circle for in-row affordance on the vendor list. */
export function VendorKycStatusDot({ status, className }: Props) {
  const t = useTranslations("vendors");
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT_COLOR[status]} ${className ?? ""}`}
      title={t(`kycStatus_${status}`)}
      aria-label={t(`kycStatus_${status}`)}
    />
  );
}
