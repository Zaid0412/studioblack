"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  Files,
  Clock,
  Wallet,
  Package,
  Hourglass,
  CircleCheck,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectOverview } from "@/hooks/useProjectOverview";
import { useLoadStagger } from "@/hooks/useLoadStagger";
import { API } from "@/lib/api/routes";
import { formatCurrency } from "@/lib/formatCurrency";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { BarChart } from "@/components/ui/BarChart";
import { OverviewCard } from "./overview/OverviewCard";
import { KpiCard } from "./overview/KpiCard";
import { ProjectDetailsCard } from "./overview/ProjectDetailsCard";
import { ActivityFeed } from "./overview/ActivityFeed";
import { TeamList } from "./overview/TeamList";
import { ReviewBanner } from "./overview/ReviewBanner";
import type { DbProjectDetail } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  approved: "var(--success)",
  pending: "var(--accent)",
  rejected: "var(--error)",
  reviewed: "var(--text-secondary)",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  approved: "statusApproved",
  pending: "statusPending",
  rejected: "statusRejected",
  reviewed: "statusReviewed",
};

/** Currency-format a raw money value (string/number) against the project currency. */
function formatMoney(
  value: string | number | null,
  currency: string | null
): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatCurrency(n, currency || DEFAULT_CURRENCY, 0);
}

/**
 * Project Overview — the project home. Renders the PM/architect dashboard or
 * the cost-scrubbed client variant. KPIs/charts/activity come from the
 * aggregation endpoint; details + team from the project resource the layout
 * already fetches (SWR-deduped).
 */
export function OverviewTab({ projectId }: { projectId: string }) {
  const t = useTranslations("projectOverview");
  const { role } = useUserRole();
  const isClient = role === "client";
  const { overview, loading } = useProjectOverview(projectId);
  const { data: project } = useSWR<DbProjectDetail>(API.project(projectId));

  const staggerRef = useLoadStagger<HTMLDivElement>(
    overview ? "ready" : "loading",
    80
  );

  if (loading || !overview || !project) {
    return <OverviewSkeleton />;
  }

  const currency = project.default_currency;
  const money = (v: string | number | null) => formatMoney(v, currency);

  const donutSegments: DonutSegment[] = overview.designStatus.map((s) => ({
    label: t(STATUS_LABEL_KEY[s.status] ?? s.status),
    value: s.count,
    color: STATUS_COLOR[s.status] ?? "var(--text-muted)",
  }));
  const { kpis } = overview;
  const base = `/projects/${projectId}`;

  const shell =
    "px-4 lg:px-10 py-6 lg:py-8 stagger-children flex flex-col gap-6";

  // Shared between both variants — the donut and the details/activity/team row
  // differ only by the client/pm variant flag. With no design files yet, the
  // donut would be an empty ring, so show a "nothing yet" hint instead.
  const donut =
    kpis.designFiles > 0 ? (
      <DonutChart
        segments={donutSegments}
        centerValue={String(kpis.designFiles)}
        centerLabel={t("filesCenter")}
      />
    ) : (
      <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
        <p className="text-sm font-medium text-text-secondary">
          {t("noDesigns")}
        </p>
        <p className="text-xs text-text-muted">{t("noDesignsHint")}</p>
      </div>
    );
  // Donut (always) + the money/percent bar chart (desktop-only). Both variants
  // share this row; only the titles and the bar's scale/format differ.
  const chartsRow = (
    <div className="grid gap-4 lg:grid-cols-2">
      <OverviewCard title={t(isClient ? "reviewProgress" : "designStatus")}>
        {donut}
      </OverviewCard>
      <OverviewCard
        title={t(isClient ? "designProgress" : "costByDivision")}
        className="hidden lg:block"
      >
        <BarChart
          bars={overview.chart.bars}
          {...(isClient
            ? { max: 100, formatValue: (v: number) => `${v}%` }
            : { formatValue: (v: number) => money(v) })}
          emptyLabel={t("noData")}
        />
      </OverviewCard>
    </div>
  );
  const detailsRow = (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ProjectDetailsCard
          project={project}
          variant={isClient ? "client" : "pm"}
        />
      </div>
      <div className="flex flex-col gap-4">
        <ActivityFeed items={overview.activity} />
        <TeamList
          members={project.members}
          variant={isClient ? "client" : "pm"}
        />
      </div>
    </div>
  );

  if (isClient) {
    const approvedCount =
      overview.designStatus.find((s) => s.status === "approved")?.count ?? 0;
    return (
      <div ref={staggerRef} className={shell}>
        <ReviewBanner count={kpis.pendingReviews} href={`${base}/designs`} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={t("awaitingYourReview")}
            value={String(kpis.pendingReviews)}
            icon={Hourglass}
            sub={kpis.pendingReviews > 0 ? t("needsAction") : undefined}
            subTone="accent"
            href={`${base}/designs`}
          />
          <KpiCard
            label={t("approvedByYou")}
            value={String(approvedCount)}
            icon={CircleCheck}
            sub={t("ofShared", { count: kpis.designFiles })}
            subTone="success"
            href={`${base}/designs`}
          />
          <KpiCard
            label={t("filesShared")}
            value={String(kpis.designFiles)}
            icon={Files}
            href={`${base}/designs`}
          />
          <KpiCard
            label={t("projectValue")}
            value={money(kpis.boqValue)}
            icon={Wallet}
            sub={kpis.boqValue == null ? t("noBoq") : undefined}
            href={`${base}/boq`}
          />
        </div>
        {chartsRow}
        {detailsRow}
      </div>
    );
  }

  return (
    <div ref={staggerRef} className={shell}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t("designFiles")}
          value={String(kpis.designFiles)}
          icon={Files}
          href={`${base}/designs`}
        />
        <KpiCard
          label={t("pendingReviews")}
          value={String(kpis.pendingReviews)}
          icon={Clock}
          sub={kpis.pendingReviews > 0 ? t("needsAction") : undefined}
          subTone="accent"
          href={`${base}/designs`}
        />
        <KpiCard
          label={t("boqValue")}
          value={money(kpis.boqValue)}
          icon={Wallet}
          sub={
            kpis.boqValue == null
              ? t("noBoq")
              : t("lines", { count: kpis.boqLineCount })
          }
          href={`${base}/boq`}
        />
        <KpiCard
          label={t("openOrders")}
          value={String(kpis.openOrders ?? 0)}
          icon={Package}
          href={`${base}/order`}
        />
      </div>
      {chartsRow}
      {detailsRow}
    </div>
  );
}

/** Page-owned skeleton (no route loading.tsx) matching the dashboard shape. */
function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-10 lg:py-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
