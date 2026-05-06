"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BoqSummary } from "@/types";
import {
  formatCurrency,
  formatPct,
  marginTier,
  toNum,
} from "../_lib/formatters";

interface BoqSummaryCardsProps {
  summary: BoqSummary;
  currency: string;
  minimumMarginPct: string;
}

/** Top-of-BOQ KPI cards: total cost, total sell, average margin, pending approvals, and margin bleed. */
export function BoqSummaryCards({
  summary,
  currency,
  minimumMarginPct,
}: BoqSummaryCardsProps) {
  const avgMargin = toNum(summary.average_margin_pct);
  const marginFloor = toNum(minimumMarginPct);
  const tier = marginTier(avgMargin, marginFloor || undefined);

  // Over Budget card only renders when there are over-budget lines, so the
  // grid stays 5-up most of the time and grows by one column when needed.
  const overBudgetVisible = summary.over_budget_count > 0;

  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 gap-3",
        overBudgetVisible ? "xl:grid-cols-6" : "xl:grid-cols-5"
      )}
    >
      <MetricCard
        label="Total Cost"
        value={formatCurrency(summary.total_cost, currency)}
      />
      <MetricCard
        label="Total Sell"
        value={formatCurrency(summary.total_sell_price, currency)}
      />
      <MetricCard
        label="Avg Margin"
        value={formatPct(avgMargin)}
        badge={
          <Badge
            variant={
              tier === "success"
                ? "success"
                : tier === "warning"
                  ? "warning"
                  : "error"
            }
          >
            {tier === "success"
              ? "Healthy"
              : tier === "warning"
                ? "Thin"
                : "Below floor"}
          </Badge>
        }
      />
      <MetricCard
        label="Pending Approvals"
        value={String(summary.pending_approvals)}
      />
      <MetricCard
        label="Margin Bleed"
        value={String(summary.margin_bleed_count)}
        badge={
          summary.margin_bleed_count > 0 ? (
            <Badge variant="error">Action needed</Badge>
          ) : null
        }
      />
      {overBudgetVisible && (
        <MetricCard
          label="Over Budget"
          value={String(summary.over_budget_count)}
          badge={<Badge variant="error">Review costs</Badge>}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2 !p-4">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-lg font-semibold text-text-primary leading-tight">
        {value}
      </span>
      {badge ?? <span className="h-5" />}
    </Card>
  );
}
