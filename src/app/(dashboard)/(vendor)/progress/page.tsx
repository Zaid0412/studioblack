"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Vendor portal progress page — placeholder until F16.6 ships. */
export default function VendorPortalProgressPage() {
  const t = useTranslations("vendorPortal");
  const tNav = useTranslations("nav");

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={tNav("progress")} />
      <EmptyState
        icon={TrendingUp}
        title={t("noProgress")}
        description={t("noProgressHint")}
      />
    </div>
  );
}
