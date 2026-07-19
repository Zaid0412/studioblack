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
  request_changes: "var(--warning)",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  approved: "statusApproved",
  pending: "statusPending",
  rejected: "statusRejected",
  request_changes: "statusChangesRequested",
};

/** Currency-format a raw money value (string/number) against the project currency. */
function formatMoney(
  value: string | number | null,
  currency: string | null
): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return n.toLocaleString("en-IN");
  }
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
  const approvedCount =
    overview.designStatus.find((s) => s.status === "approved")?.count ?? 0;
  const { kpis } = overview;

  const shell =
    "px-4 lg:px-10 py-6 lg:py-8 stagger-children flex flex-col gap-6";

  if (isClient) {
    return (
      <div ref={staggerRef} className={shell}>
        <ReviewBanner
          count={kpis.pendingReviews}
          href={`/projects/${projectId}/designs`}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={t("awaitingYourReview")}
            value={String(kpis.pendingReviews)}
            icon={Hourglass}
            sub={kpis.pendingReviews > 0 ? t("needsAction") : undefined}
            subTone="accent"
          />
          <KpiCard
            label={t("approvedByYou")}
            value={String(approvedCount)}
            icon={CircleCheck}
            sub={t("ofShared", { count: kpis.designFiles })}
            subTone="success"
          />
          <KpiCard
            label={t("filesShared")}
            value={String(kpis.designFiles)}
            icon={Files}
          />
          <KpiCard
            label={t("projectValue")}
            value={money(kpis.boqValue)}
            icon={Wallet}
            sub={kpis.boqValue == null ? t("noBoq") : undefined}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewCard title={t("reviewProgress")}>
            <DonutChart
              segments={donutSegments}
              centerValue={String(kpis.designFiles)}
              centerLabel={t("filesCenter")}
            />
          </OverviewCard>
          <OverviewCard title={t("designProgress")}>
            <BarChart
              bars={overview.chart.bars}
              max={100}
              formatValue={(v) => `${v}%`}
              emptyLabel={t("noData")}
            />
          </OverviewCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProjectDetailsCard project={project} variant="client" />
          </div>
          <div className="flex flex-col gap-4">
            <ActivityFeed items={overview.activity} />
            <TeamList members={project.members} variant="client" />
          </div>
        </div>
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
        />
        <KpiCard
          label={t("pendingReviews")}
          value={String(kpis.pendingReviews)}
          icon={Clock}
          sub={kpis.pendingReviews > 0 ? t("needsAction") : undefined}
          subTone="accent"
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
        />
        <KpiCard
          label={t("openOrders")}
          value={String(kpis.openOrders ?? 0)}
          icon={Package}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewCard title={t("designStatus")}>
          <DonutChart
            segments={donutSegments}
            centerValue={String(kpis.designFiles)}
            centerLabel={t("filesCenter")}
          />
        </OverviewCard>
        <OverviewCard title={t("costByDivision")}>
          <BarChart
            bars={overview.chart.bars}
            formatValue={(v) => money(v)}
            emptyLabel={t("noData")}
          />
        </OverviewCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProjectDetailsCard project={project} variant="pm" />
        </div>
        <div className="flex flex-col gap-4">
          <ActivityFeed items={overview.activity} />
          <TeamList members={project.members} variant="pm" />
        </div>
      </div>
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
