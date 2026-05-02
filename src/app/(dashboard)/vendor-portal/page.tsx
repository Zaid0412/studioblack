"use client";

import { useTranslations } from "next-intl";
import { FileText, Receipt, ScrollText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

/** Vendor portal landing page — dashboard with metric cards (zero-state placeholders). */
export default function VendorPortalPage() {
  const t = useTranslations("vendorPortal");

  const stats = [
    { label: t("openRfqs"), value: "0", icon: FileText },
    { label: t("activePOs"), value: "0", icon: ScrollText },
    { label: t("pendingInvoices"), value: "0", icon: Receipt },
    { label: t("overallCompletion"), value: "0%", icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-muted">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-text-muted" />
            </div>
            <span className="text-[32px] font-bold text-text-primary">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
