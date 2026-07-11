"use client";

import { useTranslations } from "next-intl";
import { FileText, Receipt, ScrollText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { VendorPortalComingSoon } from "@/components/vendor/VendorPortalComingSoon";
import { useFlag } from "@/hooks/useFlag";
import { useVendorRfqs } from "@/hooks/useRfqs";
import { useLoadStagger } from "@/hooks/useLoadStagger";

/**
 * Vendor dashboard — served at /dashboard (role-routed, like the client one).
 * Gated on the `vendorPortal` PostHog flag, replicating the server gate that
 * used to live in `vendor-portal/layout.tsx`: off in prod → coming-soon panel,
 * so moving the dashboard out from under that layout doesn't leak the
 * unfinished portal. The other vendor pages are top-level routes (/rfqs,
 * /purchase-orders, …) under the `(vendor)` route group.
 */
export function VendorDashboard() {
  const t = useTranslations("vendorPortal");
  const enabled = useFlag("vendorPortal");

  // Server filters out `draft` and `cancelled` already, so `total` here is
  // exactly the count of RFQs awaiting/in-progress/awarded for this vendor.
  // `enabled` gates the fetch: the endpoint 403s when the flag is off, and this
  // dashboard renders the coming-soon panel in that case anyway.
  const { total: openRfqs, isLoading } = useVendorRfqs({
    page: 1,
    limit: 1,
    enabled,
  });

  const staggerRef = useLoadStagger<HTMLDivElement>(isLoading ? "0" : "1");

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
      href: "/rfqs",
    },
    {
      label: t("activePOs"),
      value: "0",
      icon: ScrollText,
      href: "/purchase-orders",
    },
    {
      label: t("pendingInvoices"),
      value: "0",
      icon: Receipt,
      href: "/invoices",
    },
    {
      label: t("overallCompletion"),
      value: "0%",
      icon: TrendingUp,
      href: "/progress",
    },
  ];

  return (
    <div ref={staggerRef} className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="an-rise grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
