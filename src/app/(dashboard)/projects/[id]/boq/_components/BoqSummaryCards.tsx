"use client";

import { useTranslations } from "next-intl";
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

interface Stat {
  label: string;
  value: string;
  badge?: React.ReactNode;
}

/** Top-of-BOQ KPIs as one compact strip: cost, sell, margin, approvals, bleed. */
export function BoqSummaryCards({
  summary,
  currency,
  minimumMarginPct,
}: BoqSummaryCardsProps) {
  const t = useTranslations("boq.table");
  const avgMargin = toNum(summary.average_margin_pct);
  const marginFloor = toNum(minimumMarginPct);
  const tier = marginTier(avgMargin, marginFloor || undefined);

  const stats: Stat[] = [
    {
      label: "Total Cost",
      value: formatCurrency(summary.total_cost, currency),
    },
    {
      label: t("totalProposedPrice"),
      value: formatCurrency(summary.total_sell_price, currency),
    },
    {
      label: "Avg Margin",
      value: formatPct(avgMargin),
      badge: (
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
      ),
    },
    { label: "Pending Approvals", value: String(summary.pending_approvals) },
    {
      label: "Margin Bleed",
      value: String(summary.margin_bleed_count),
      badge:
        summary.margin_bleed_count > 0 ? (
          <Badge variant="error">Action needed</Badge>
        ) : undefined,
    },
  ];

  // Over Budget joins the strip only when there are over-budget lines.
  if (summary.over_budget_count > 0) {
    stats.push({
      label: "Over Budget",
      value: String(summary.over_budget_count),
      badge: <Badge variant="error">Review costs</Badge>,
    });
  }

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap divide-x divide-border-default">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex min-w-[150px] flex-1 flex-col gap-1 px-4 py-3"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {s.label}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-base font-semibold leading-tight text-text-primary tabular-nums",
                  s.badge && "whitespace-nowrap"
                )}
              >
                {s.value}
              </span>
              {s.badge}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
