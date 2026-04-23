"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileSpreadsheet } from "lucide-react";
import type { BoqItemWithComputed, BoqSection, BoqSummary } from "@/types";
import {
  clientApprovalToVariant,
  formatCurrency,
  formatPct,
  formatQty,
  lifecycleToVariant,
  marginTier,
  toNum,
} from "../_lib/formatters";
import { BoqSectionHeader } from "./BoqSectionHeader";

interface BoqTableProps {
  sections: BoqSection[];
  items: BoqItemWithComputed[];
  summary: BoqSummary;
  currency: string;
  minimumMarginPct: string;
}

interface SectionGroup {
  id: string;
  title: string;
  visibleToClient?: boolean;
  items: BoqItemWithComputed[];
  total: number;
}

const UNASSIGNED_ID = "__unassigned__";

// Grid template covering all 10 columns — keeps header + rows aligned.
// Tuned to fit a ~1100px content area without horizontal scroll.
const GRID_COLS =
  "grid-cols-[70px_minmax(160px,1fr)_50px_70px_90px_100px_75px_100px_95px_85px]";

export function BoqTable({
  sections,
  items,
  summary,
  currency,
  minimumMarginPct,
}: BoqTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const marginFloor = toNum(minimumMarginPct) || undefined;

  const groups = useMemo<SectionGroup[]>(() => {
    const bySection = new Map<string, BoqItemWithComputed[]>();
    const unassigned: BoqItemWithComputed[] = [];
    for (const item of items) {
      if (item.section_id === null) {
        unassigned.push(item);
        continue;
      }
      const bucket = bySection.get(item.section_id);
      if (bucket) bucket.push(item);
      else bySection.set(item.section_id, [item]);
    }

    const sectionTotalFromSummary = (sectionId: string | null): number => {
      const match = summary.section_totals.find(
        (s) => s.section_id === sectionId
      );
      return match ? toNum(match.total_sell_price) : 0;
    };

    const result: SectionGroup[] = [];
    if (unassigned.length > 0) {
      result.push({
        id: UNASSIGNED_ID,
        title: "(Unassigned)",
        items: unassigned,
        total: sectionTotalFromSummary(null),
      });
    }
    for (const section of sections) {
      result.push({
        id: section.id,
        title: section.title,
        visibleToClient: section.is_visible_to_client,
        items: bySection.get(section.id) ?? [],
        total: sectionTotalFromSummary(section.id),
      });
    }
    return result;
  }, [sections, items, summary.section_totals]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No line items yet"
        description="Add items to this BOQ to start tracking quantities and costs."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <div>
        <div
          className={`hidden lg:grid ${GRID_COLS} gap-2 px-3 py-3 border-b border-border-default text-[11px] font-bold text-text-primary uppercase tracking-wide`}
        >
          <div>Code</div>
          <div>Description</div>
          <div>Unit</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Unit Cost</div>
          <div className="text-right">Total Cost</div>
          <div className="text-right">Margin</div>
          <div className="text-right">Sell Price</div>
          <div>Lifecycle</div>
          <div>Client</div>
        </div>

        <div className="flex flex-col">
          {groups.map((group) => {
            const isCollapsed = collapsed[group.id] ?? false;
            return (
              <div key={group.id}>
                <BoqSectionHeader
                  title={group.title}
                  itemCount={group.items.length}
                  sectionTotal={group.total}
                  currency={currency}
                  collapsed={isCollapsed}
                  onToggle={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [group.id]: !isCollapsed,
                    }))
                  }
                  visibleToClient={group.visibleToClient}
                />
                {!isCollapsed &&
                  group.items.map((item) => (
                    <BoqItemRow
                      key={item.id}
                      item={item}
                      currency={currency}
                      marginFloor={marginFloor}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BoqItemRow({
  item,
  currency,
  marginFloor,
}: {
  item: BoqItemWithComputed;
  currency: string;
  marginFloor?: number;
}) {
  const tier = marginTier(toNum(item.margin_pct), marginFloor);
  const marginColor =
    tier === "success"
      ? "text-success"
      : tier === "warning"
        ? "text-warning"
        : "text-error";

  return (
    <div
      className={`grid ${GRID_COLS} gap-2 px-3 py-3 items-center border-b border-border-default last:border-b-0 text-sm hover:bg-bg-elevated/50 transition-colors`}
    >
      <span className="text-xs text-text-muted font-mono truncate">
        {item.item_code}
      </span>
      <span className="text-text-primary truncate" title={item.description}>
        {item.description}
      </span>
      <span className="text-xs text-text-muted">{item.unit}</span>
      <span className="text-right tabular-nums text-text-primary">
        {formatQty(item.quantity)}
      </span>
      <span className="text-right tabular-nums text-text-primary">
        {formatCurrency(item.unit_cost, currency)}
      </span>
      <span className="text-right tabular-nums text-text-primary">
        {formatCurrency(item.total_cost, currency)}
      </span>
      <span
        className={`text-right tabular-nums font-medium ${marginColor} flex items-center justify-end gap-1`}
      >
        {item.margin_alert && <AlertTriangle className="w-3.5 h-3.5" />}
        {formatPct(item.margin_pct)}
      </span>
      <span className="text-right tabular-nums text-text-primary">
        {formatCurrency(item.sell_price, currency)}
      </span>
      <span className="min-w-0">
        <Badge
          variant={lifecycleToVariant(item.lifecycle_status)}
          className="!px-2 truncate max-w-full"
        >
          {item.lifecycle_status.replace(/_/g, " ")}
        </Badge>
      </span>
      <span className="min-w-0">
        <Badge
          variant={clientApprovalToVariant(item.client_approval_status)}
          className="!px-2 truncate max-w-full"
        >
          {item.client_approval_status}
        </Badge>
      </span>
    </div>
  );
}
