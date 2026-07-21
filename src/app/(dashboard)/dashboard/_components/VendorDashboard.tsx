"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  FileText,
  Hourglass,
  Award,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { OverviewCard } from "@/app/(dashboard)/projects/[id]/_components/overview/OverviewCard";
import { VendorPortalComingSoon } from "@/components/vendor/VendorPortalComingSoon";
import { useFlag } from "@/hooks/useFlag";
import { useVendorDashboard } from "@/hooks/useVendorDashboard";
import { useLoadStagger } from "@/hooks/useLoadStagger";
import { fromIsoDate, formatShortDate } from "@/lib/formatDate";
import {
  QUOTE_OUTCOME_BUCKET,
  type VendorQuoteStatus,
} from "@/lib/validations";
import type { VendorAwaitingRfq, VendorQuoteOutcome } from "@/types";

/** Days-until-deadline urgency: overdue → error, ≤3 days → warning, else none. */
function deadlineUrgency(deadline: string | null): "overdue" | "soon" | null {
  const d = fromIsoDate(deadline);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return null;
}

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
  const { dashboard, loading } = useVendorDashboard();

  const staggerRef = useLoadStagger<HTMLDivElement>(dashboard ? "1" : "0");

  if (!enabled) {
    return (
      <VendorPortalComingSoon
        title={t("title")}
        comingSoon={t("comingSoon")}
        comingSoonHint={t("comingSoonHint")}
      />
    );
  }

  if (loading || !dashboard) {
    return <VendorDashboardSkeleton />;
  }

  const { kpis, outcomes, awaitingRfqs } = dashboard;
  const winRate = `${kpis.winRate}%`;

  const stats = [
    {
      label: t("openRfqs"),
      value: String(kpis.openRfqs),
      icon: FileText,
      href: "/rfqs",
    },
    {
      label: t("dashboard.quotesUnderReview"),
      value: String(kpis.quotesUnderReview),
      icon: Hourglass,
      href: "/rfqs?status=under_review",
    },
    {
      label: t("dashboard.awarded"),
      value: String(kpis.awarded),
      icon: Award,
      href: "/rfqs?status=awarded",
    },
    // Win rate is a derived ratio, not a navigable list — display only.
    { label: t("dashboard.winRate"), value: winRate, icon: TrendingUp },
  ];

  const segments = outcomeSegments(outcomes, t);
  const hasQuotes = segments.some((s) => s.value > 0);

  return (
    <div ref={staggerRef} className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="an-rise grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="an-rise grid gap-4 lg:grid-cols-2">
        <OverviewCard title={t("dashboard.quoteOutcomes")}>
          {hasQuotes ? (
            <DonutChart
              segments={segments}
              centerValue={winRate}
              centerLabel={t("dashboard.winRateCenter")}
            />
          ) : (
            <EmptyHint
              title={t("dashboard.noQuotes")}
              hint={t("dashboard.noQuotesHint")}
            />
          )}
        </OverviewCard>

        <OverviewCard title={t("dashboard.awaitingResponse")}>
          {awaitingRfqs.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border-default">
              {awaitingRfqs.map((rfq) => (
                <AwaitingRow key={rfq.id} rfq={rfq} t={t} />
              ))}
            </ul>
          ) : (
            <EmptyHint title={t("noRfqs")} hint={t("noRfqsHint")} />
          )}
        </OverviewCard>
      </div>
    </div>
  );
}

/** One RFQ row in the "awaiting response" list. */
function AwaitingRow({
  rfq,
  t,
}: {
  rfq: VendorAwaitingRfq;
  t: ReturnType<typeof useTranslations>;
}) {
  const urgency = deadlineUrgency(rfq.response_deadline);
  const due = rfq.response_deadline
    ? t("dashboard.due", { date: formatShortDate(rfq.response_deadline) })
    : t("dashboard.noDeadline");

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {rfq.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
          <span>{rfq.rfq_number}</span>
          <span aria-hidden>·</span>
          <span>{t("dashboard.items", { count: rfq.item_count })}</span>
          <span aria-hidden>·</span>
          <span>{due}</span>
        </p>
      </div>
      {urgency && (
        <Badge variant={urgency === "overdue" ? "error" : "warning"}>
          {t(urgency === "overdue" ? "dashboard.overdue" : "dashboard.dueSoon")}
        </Badge>
      )}
      <Link
        href={`/rfqs/${rfq.id}`}
        className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent outline-none ring-1 ring-transparent transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t("dashboard.submitQuote")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

/** Map the current-quote outcome buckets to donut segments (lost per `QUOTE_OUTCOME_BUCKET`). */
function outcomeSegments(
  outcomes: VendorQuoteOutcome[],
  t: ReturnType<typeof useTranslations>
): DonutSegment[] {
  const count = (status: string) =>
    outcomes.find((o) => o.status === status)?.count ?? 0;
  const lost = outcomes.reduce(
    (n, o) =>
      n +
      (QUOTE_OUTCOME_BUCKET[o.status as VendorQuoteStatus] === "lost"
        ? o.count
        : 0),
    0
  );
  return [
    {
      label: t("dashboard.outcomeAwarded"),
      value: count("awarded"),
      color: "var(--success)",
    },
    {
      label: t("dashboard.outcomeUnderReview"),
      value: count("under_review"),
      color: "var(--accent)",
    },
    {
      label: t("dashboard.outcomeSubmitted"),
      value: count("submitted"),
      color: "var(--info)",
    },
    {
      label: t("dashboard.outcomeLost"),
      value: lost,
      color: "var(--text-muted)",
    },
  ];
}

/** Page-owned skeleton (no route loading.tsx). */
function VendorDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
