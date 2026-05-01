"use client";

import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Vendor portal RFQs page — placeholder until F9 ships. */
export default function VendorPortalRfqsPage() {
  const t = useTranslations("vendorPortal");
  const tNav = useTranslations("nav");

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={tNav("rfqs")} />
      <EmptyState
        icon={FileText}
        title={t("noRfqs")}
        description={t("noRfqsHint")}
      />
    </div>
  );
}
