"use client";

import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Vendor portal invoices page — placeholder until F22 ships. */
export default function VendorPortalInvoicesPage() {
  const t = useTranslations("vendorPortal");
  const tNav = useTranslations("nav");

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={tNav("invoices")} />
      <EmptyState
        icon={Receipt}
        title={t("noInvoices")}
        description={t("noInvoicesHint")}
      />
    </div>
  );
}
