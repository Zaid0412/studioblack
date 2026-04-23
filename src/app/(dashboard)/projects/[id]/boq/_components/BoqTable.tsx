"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { BoqItemWithComputed, BoqSection, BoqSummary } from "@/types";
import type { BoqStatus } from "@/lib/validations";
import {
  BOQ_NO_SECTION_ID,
  clientApprovalToVariant,
  formatCurrency,
  formatPct,
  formatQty,
  lifecycleToVariant,
  marginTier,
  toNum,
} from "../_lib/formatters";
import { BoqSectionHeader } from "./BoqSectionHeader";
import { BoqEditableCell } from "./BoqEditableCell";
import type { UpdateItemPayload } from "@/lib/api/boq";

interface BoqTableProps {
  sections: BoqSection[];
  items: BoqItemWithComputed[];
  summary: BoqSummary;
  currency: string;
  minimumMarginPct: string;
  boqStatus: BoqStatus;
  canEdit: boolean;
  onUpdateItem?: (
    itemId: string,
    data: UpdateItemPayload
  ) => Promise<BoqItemWithComputed | null | undefined>;
  onDeleteItem?: (item: BoqItemWithComputed) => Promise<void>;
  onRenameSection?: (section: BoqSection) => void;
  onToggleSectionVisibility?: (section: BoqSection) => void;
  onDeleteSection?: (section: BoqSection) => void;
  onAddItemToSection?: (sectionId: string | null) => void;
  onOpenItem?: (item: BoqItemWithComputed) => void;
}

interface SectionGroup {
  id: string;
  title: string;
  section: BoqSection | null;
  visibleToClient?: boolean;
  items: BoqItemWithComputed[];
  total: number;
}

// Tuned to fit a ~1100px content area without horizontal scroll.
export const GRID_COLS =
  "grid-cols-[70px_minmax(160px,1fr)_50px_70px_90px_100px_75px_100px_95px_85px_32px]";

function isBoqLocked(status: BoqStatus): boolean {
  return status === "locked" || status === "superseded";
}

function isItemLocked(item: BoqItemWithComputed): boolean {
  return (
    item.lifecycle_status === "locked" || item.lifecycle_status === "superseded"
  );
}

export function BoqTable({
  sections,
  items,
  summary,
  currency,
  minimumMarginPct,
  boqStatus,
  canEdit,
  onUpdateItem,
  onDeleteItem,
  onRenameSection,
  onToggleSectionVisibility,
  onDeleteSection,
  onAddItemToSection,
  onOpenItem,
}: BoqTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const marginFloor = toNum(minimumMarginPct) || undefined;
  const boqLocked = isBoqLocked(boqStatus);
  const rowsEditable = canEdit && !boqLocked && !!onUpdateItem;
  const sectionsEditable = canEdit && !boqLocked;

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
        id: BOQ_NO_SECTION_ID,
        title: "(Unassigned)",
        section: null,
        items: unassigned,
        total: sectionTotalFromSummary(null),
      });
    }
    for (const section of sections) {
      result.push({
        id: section.id,
        title: section.title,
        section,
        visibleToClient: section.is_visible_to_client,
        items: bySection.get(section.id) ?? [],
        total: sectionTotalFromSummary(section.id),
      });
    }
    return result;
  }, [sections, items, summary.section_totals]);

  if (items.length === 0 && sections.length === 0) {
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
          <div />
        </div>

        <div className="flex flex-col">
          {groups.map((group) => {
            const isCollapsed = collapsed[group.id] ?? false;
            const section = group.section;
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
                  onAddItem={
                    sectionsEditable && onAddItemToSection
                      ? () => onAddItemToSection(section?.id ?? null)
                      : undefined
                  }
                  onRename={
                    sectionsEditable && section && onRenameSection
                      ? () => onRenameSection(section)
                      : undefined
                  }
                  onToggleVisibility={
                    sectionsEditable && section && onToggleSectionVisibility
                      ? () => onToggleSectionVisibility(section)
                      : undefined
                  }
                  onDelete={
                    sectionsEditable && section && onDeleteSection
                      ? () => onDeleteSection(section)
                      : undefined
                  }
                />
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                  }`}
                  aria-hidden={isCollapsed}
                >
                  <div className="overflow-hidden">
                    {group.items.map((item) => (
                      <BoqItemRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        marginFloor={marginFloor}
                        editable={rowsEditable && !isItemLocked(item)}
                        onUpdateItem={onUpdateItem}
                        onDeleteItem={onDeleteItem}
                        onOpen={onOpenItem}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface BoqItemRowProps {
  item: BoqItemWithComputed;
  currency: string;
  marginFloor?: number;
  editable: boolean;
  onUpdateItem?: (
    itemId: string,
    data: UpdateItemPayload
  ) => Promise<BoqItemWithComputed | null | undefined>;
  onDeleteItem?: (item: BoqItemWithComputed) => Promise<void>;
  onOpen?: (item: BoqItemWithComputed) => void;
}

const BoqItemRow = memo(function BoqItemRow({
  item,
  currency,
  marginFloor,
  editable,
  onUpdateItem,
  onDeleteItem,
  onOpen,
}: BoqItemRowProps) {
  const tier = marginTier(toNum(item.margin_pct), marginFloor);
  const marginColor =
    tier === "success"
      ? "text-success"
      : tier === "warning"
        ? "text-warning"
        : "text-error";

  const save = useCallback(
    async (patch: Partial<UpdateItemPayload>) => {
      if (!onUpdateItem) return;
      await onUpdateItem(item.id, {
        updatedAt: item.updated_at,
        ...patch,
      });
    },
    [onUpdateItem, item.id, item.updated_at]
  );

  const showMenu = editable && onDeleteItem;

  return (
    <div
      className={`grid ${GRID_COLS} gap-2 px-3 py-3 items-center border-b border-border-default last:border-b-0 text-sm hover:bg-bg-elevated/50 transition-colors`}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="text-xs text-text-muted font-mono truncate text-left hover:text-accent cursor-pointer focus:outline-none focus-visible:text-accent"
          aria-label={`Open details for ${item.item_code}`}
        >
          {item.item_code}
        </button>
      ) : (
        <span className="text-xs text-text-muted font-mono truncate">
          {item.item_code}
        </span>
      )}
      <BoqEditableCell
        value={item.description}
        display={item.description}
        disabled={!editable}
        onSave={(next) => save({ description: next })}
        className="text-text-primary"
        ariaLabel={`Description for ${item.item_code}`}
      />
      <span className="text-xs text-text-muted">{item.unit}</span>
      <BoqEditableCell
        value={item.quantity}
        display={formatQty(item.quantity)}
        mode="number"
        min={0}
        align="right"
        disabled={!editable}
        onSave={(next) => save({ quantity: parseFloat(next) })}
        className="tabular-nums text-text-primary"
        ariaLabel={`Quantity for ${item.item_code}`}
      />
      <BoqEditableCell
        value={item.unit_cost}
        display={formatCurrency(item.unit_cost, currency)}
        mode="number"
        min={0}
        align="right"
        disabled={!editable}
        onSave={(next) => save({ unitCost: parseFloat(next) })}
        className="tabular-nums text-text-primary"
        ariaLabel={`Unit cost for ${item.item_code}`}
      />
      <span className="text-right tabular-nums text-text-primary">
        {formatCurrency(item.total_cost, currency)}
      </span>
      <span
        className={`text-right tabular-nums font-medium ${marginColor} flex items-center justify-end gap-1`}
      >
        {item.margin_alert && <AlertTriangle className="w-3.5 h-3.5" />}
        <BoqEditableCell
          value={item.margin_pct}
          display={formatPct(item.margin_pct)}
          mode="number"
          min={0}
          max={100}
          align="right"
          disabled={!editable}
          onSave={(next) => save({ marginPct: parseFloat(next) })}
          className="tabular-nums"
          ariaLabel={`Margin for ${item.item_code}`}
        />
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
      <span className="flex justify-end">
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary cursor-pointer"
              aria-label={`Actions for ${item.item_code}`}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => void onDeleteItem!(item)}
                className="text-error focus:text-error"
              >
                Delete item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </div>
  );
});
