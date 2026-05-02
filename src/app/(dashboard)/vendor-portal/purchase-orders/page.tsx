"use client";

import { useTranslations } from "next-intl";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Vendor portal POs page — placeholder until F14 ships. */
export default function VendorPortalPOsPage() {
  const t = useTranslations("vendorPortal");
  const tNav = useTranslations("nav");

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={tNav("purchaseOrders")} />
      <EmptyState
        icon={ScrollText}
        title={t("noPOs")}
        description={t("noPOsHint")}
      />
    </div>
  );
}
