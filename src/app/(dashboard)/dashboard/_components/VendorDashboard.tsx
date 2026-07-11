"use client";

import { useTranslations } from "next-intl";
import { FileText, Receipt, ScrollText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { VendorPortalComingSoon } from "@/components/vendor/VendorPortalComingSoon";
import { useFlag } from "@/hooks/useFlag";
import { useVendorRfqs } from "@/hooks/useRfqs";

/**
 * Vendor dashboard — served at /dashboard (role-routed, like the client one).
 * Gated on the `vendorPortal` PostHog flag, replicating the server gate that
 * used to live in `vendor-portal/layout.tsx`: off in prod → coming-soon panel,
 * so moving the dashboard out from under that layout doesn't leak the
 * unfinished portal. The other vendor pages still live at /vendor-portal/*.
 */
export function VendorDashboard() {
  const t = useTranslations("vendorPortal");
  const enabled = useFlag("vendorPortal");

  // Server filters out `draft` and `cancelled` already, so `total` here is
  // exactly the count of RFQs awaiting/in-progress/awarded for this vendor.
  const { total: openRfqs, isLoading } = useVendorRfqs({ page: 1, limit: 1 });

  if (!enabled) {
    return (
      <VendorPortalComingSoon
        title={t("title")}
        comingSoon={t("comingSoon")}
        comingSoonHint={t("comingSoonHint")}
      />
    );
  }

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
