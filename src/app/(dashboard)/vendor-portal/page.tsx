"use client";

import { useTranslations } from "next-intl";
import { FileText, Receipt, ScrollText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { useVendorRfqs } from "@/hooks/useRfqs";

/**
 * Vendor portal landing page — Open RFQs count is live; PO / invoice /
 * progress cards are still placeholders pending F10–F16.6.
 */
export default function VendorPortalPage() {
  const t = useTranslations("vendorPortal");

  // Server filters out `draft` and `cancelled` already, so `total` here is
  // exactly the count of RFQs awaiting/in-progress/awarded for this vendor.
  const { total: openRfqs, isLoading } = useVendorRfqs({
    page: 1,
    limit: 1,
  });

  const stats = [
    {
      label: t("openRfqs"),
      value: isLoading ? "…" : String(openRfqs),
      icon: FileText,
      href: "/vendor-portal/rfqs",
    },
    {
      label: t("activePOs"),
      value: "0",
      icon: ScrollText,
      href: "/vendor-portal/purchase-orders",
    },
    {
      label: t("pendingInvoices"),
      value: "0",
      icon: Receipt,
      href: "/vendor-portal/invoices",
    },
    {
      label: t("overallCompletion"),
      value: "0%",
      icon: TrendingUp,
      href: "/vendor-portal/progress",
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            href={stat.href}
          />
        ))}
      </div>
    </div>
  );
}
