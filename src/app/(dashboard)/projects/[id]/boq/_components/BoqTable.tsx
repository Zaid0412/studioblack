"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, FileSpreadsheet, MoreVertical } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { BoqSectionFooter } from "./BoqSectionFooter";
import { BoqSectionChips, type BoqChipDescriptor } from "./BoqSectionChips";
import { BoqEditableCell } from "./BoqEditableCell";
import { BoqSourceBadge } from "./BoqSourceBadge";
import type { UpdateItemPayload } from "@/lib/api/boq";
import type { BoqItemSource } from "@/lib/validations";

interface BoqTableProps {
  sections: BoqSection[];
  items: BoqItemWithComputed[];
  summary: BoqSummary;
  currency: string;
  minimumMarginPct: string;
  boqStatus: BoqStatus;
  canEdit: boolean;
  /** When set, only items whose `source` is in the set are rendered. Empty/undefined → no filter. */
  sourceFilter?: ReadonlySet<BoqItemSource>;
  onUpdateItem?: (
    itemId: string,
    data: UpdateItemPayload
  ) => Promise<BoqItemWithComputed | null | undefined>;
  onDeleteItem?: (item: BoqItemWithComputed) => Promise<void>;
  onRenameSection?: (section: BoqSection) => void;
  onToggleSectionVisibility?: (section: BoqSection) => void;
  onDeleteSection?: (section: BoqSection) => void;
  onAddItemToSection?: (sectionId: string | null) => void;
  onReorderSections?: (orderedIds: string[]) => void;
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

// The Source column is narrow on purpose — it carries a single short badge.
export const GRID_COLS =
  "grid-cols-[70px_minmax(160px,1fr)_72px_50px_70px_90px_100px_75px_100px_95px_85px_32px]";

/**
 * Sum of the fixed column widths above (999px) plus 11 inter-column gaps
 * (gap-2 = 88px) = 1087px. Applied as `min-w` on the table's scrollable
 * wrapper so columns never squish below their declared sizes; below the
 * threshold the wrapper scrolls horizontally instead, keeping header and
 * rows aligned.
 */
export const TABLE_MIN_WIDTH = "min-w-[1087px]";

function isBoqLocked(status: BoqStatus): boolean {
  return status === "locked" || status === "superseded";
}

function isItemLocked(item: BoqItemWithComputed): boolean {
  return (
    item.lifecycle_status === "locked" || item.lifecycle_status === "superseded"
  );
}

/** BOQ line-item grid: groups items under sortable sections, supports inline edits and item-level actions. */
export function BoqTable({
  sections,
  items,
  summary,
  currency,
  minimumMarginPct,
  boqStatus,
  canEdit,
  sourceFilter,
  onUpdateItem,
  onDeleteItem,
  onRenameSection,
  onToggleSectionVisibility,
  onDeleteSection,
  onAddItemToSection,
  onReorderSections,
  onOpenItem,
}: BoqTableProps) {
  const t = useTranslations("boq.table");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const marginFloor = toNum(minimumMarginPct) || undefined;
  const boqLocked = isBoqLocked(boqStatus);
  const rowsEditable = canEdit && !boqLocked && !!onUpdateItem;
  const sectionsEditable = canEdit && !boqLocked;
  // One ref per section header — chip strip uses these for IntersectionObserver
  // and smooth-scroll targets without prop-drilling refs through the section body.
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerSectionRef = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el === null) sectionRefs.current.delete(id);
      else sectionRefs.current.set(id, el);
    },
    []
  );
  const getSectionEl = useCallback(
    (id: string) => sectionRefs.current.get(id) ?? null,
    []
  );

  const visibleItems = useMemo(() => {
    if (!sourceFilter || sourceFilter.size === 0) return items;
    return items.filter((it) => sourceFilter.has(it.source));
  }, [items, sourceFilter]);

  const groups = useMemo<SectionGroup[]>(() => {
    const bySection = new Map<string, BoqItemWithComputed[]>();
    const unassigned: BoqItemWithComputed[] = [];
    for (const item of visibleItems) {
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
  }, [sections, visibleItems, summary.section_totals]);

  const chips = useMemo<BoqChipDescriptor[]>(
    () =>
      groups.map((g) => ({
        id: g.id,
        title: g.title,
        itemCount: g.items.length,
      })),
    [groups]
  );

  const expandSection = useCallback((sectionId: string) => {
    setCollapsed((prev) =>
      prev[sectionId] ? { ...prev, [sectionId]: false } : prev
    );
  }, []);

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
      <BoqSectionChips
        chips={chips}
        getSectionEl={getSectionEl}
        onActivate={expandSection}
      />
      <div className="overflow-x-auto">
        <div className={TABLE_MIN_WIDTH}>
          <div
            className={`grid ${GRID_COLS} gap-2 px-3 py-3 border-b border-border-default text-[11px] font-bold text-text-primary uppercase tracking-wide`}
          >
            <div>Code</div>
            <div>Description</div>
            <div>{t("columnSource")}</div>
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

          <SectionList
            groups={groups}
            sections={sections}
            currency={currency}
            marginFloor={marginFloor}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            rowsEditable={rowsEditable}
            sectionsEditable={sectionsEditable}
            registerSectionRef={registerSectionRef}
            onUpdateItem={onUpdateItem}
            onDeleteItem={onDeleteItem}
            onOpenItem={onOpenItem}
            onAddItemToSection={onAddItemToSection}
            onRenameSection={onRenameSection}
            onToggleSectionVisibility={onToggleSectionVisibility}
            onDeleteSection={onDeleteSection}
            onReorderSections={onReorderSections}
          />
        </div>
      </div>
    </div>
  );
}

// ── Section list + sortable wrapper ────────────────────────────────────────

interface SectionListProps {
  groups: SectionGroup[];
  sections: BoqSection[];
  currency: string;
  marginFloor?: number;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  rowsEditable: boolean;
  sectionsEditable: boolean;
  registerSectionRef: (id: string, el: HTMLElement | null) => void;
  onUpdateItem?: BoqTableProps["onUpdateItem"];
  onDeleteItem?: BoqTableProps["onDeleteItem"];
  onOpenItem?: BoqTableProps["onOpenItem"];
  onAddItemToSection?: BoqTableProps["onAddItemToSection"];
  onRenameSection?: BoqTableProps["onRenameSection"];
  onToggleSectionVisibility?: BoqTableProps["onToggleSectionVisibility"];
  onDeleteSection?: BoqTableProps["onDeleteSection"];
  onReorderSections?: BoqTableProps["onReorderSections"];
}

function SectionList(props: SectionListProps) {
  const { groups, sections, onReorderSections, sectionsEditable } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const unassigned = groups.find((g) => g.section === null);
  const realGroups = groups.filter((g) => g.section !== null);
  const canReorder =
    sectionsEditable && onReorderSections && realGroups.length > 1;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderSections?.(arrayMove(ids, oldIndex, newIndex));
  };

  const renderBody = (group: SectionGroup): ReactNode => (
    <SectionBody group={group} {...props} />
  );

  return (
    <div className="flex flex-col">
      {unassigned && renderBody(unassigned)}
      {canReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={realGroups.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            {realGroups.map((group) => (
              <SortableSection key={group.id} id={group.id}>
                {renderBody(group)}
              </SortableSection>
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        realGroups.map((group) => <div key={group.id}>{renderBody(group)}</div>)
      )}
    </div>
  );
}

function SortableSection({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  // Use Translate (not Transform) so variable-height siblings don't force a
  // scaleY onto the dragged node — otherwise hovering an expanded section
  // would stretch the section being dragged.
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {/* Clone children and inject drag handle props into the first child's
          dragHandleProps. Simpler: re-render section body via context. */}
      <SortableSectionContext.Provider
        value={{ attributes, listeners, setNodeRef: null }}
      >
        {children}
      </SortableSectionContext.Provider>
    </div>
  );
}

const SortableSectionContext = createContext<{
  attributes: React.HTMLAttributes<HTMLButtonElement>;
  listeners: Record<string, unknown> | undefined;
  setNodeRef: null;
} | null>(null);

function SectionBody({
  group,
  currency,
  marginFloor,
  collapsed,
  setCollapsed,
  rowsEditable,
  sectionsEditable,
  registerSectionRef,
  onUpdateItem,
  onDeleteItem,
  onOpenItem,
  onAddItemToSection,
  onRenameSection,
  onToggleSectionVisibility,
  onDeleteSection,
}: SectionListProps & { group: SectionGroup }) {
  const isCollapsed = collapsed[group.id] ?? false;
  const section = group.section;
  const sortableCtx = useContext(SortableSectionContext);
  const dragHandleProps = sortableCtx
    ? { ...sortableCtx.attributes, ...(sortableCtx.listeners ?? {}) }
    : undefined;

  const headerRefCallback = useCallback(
    (el: HTMLDivElement | null) => registerSectionRef(group.id, el),
    [registerSectionRef, group.id]
  );

  return (
    <div>
      <div ref={headerRefCallback}>
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
          dragHandleProps={dragHandleProps}
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
      </div>
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
          {group.items.length > 0 && (
            <BoqSectionFooter
              itemCount={group.items.length}
              sectionTotal={group.total}
              currency={currency}
            />
          )}
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
      <span className="flex items-center gap-1.5 min-w-0">
        {item.is_provisional && (
          <span
            title="Provisional"
            className="flex-shrink-0 inline-flex items-center rounded bg-warning/20 text-warning text-[9px] font-semibold px-1 py-0.5 leading-none"
          >
            PROV
          </span>
        )}
        {item.is_excluded && (
          <span
            title="Excluded"
            className="flex-shrink-0 inline-flex items-center rounded bg-border-default text-text-muted text-[9px] font-semibold px-1 py-0.5 leading-none line-through"
          >
            EXCL
          </span>
        )}
        <BoqEditableCell
          value={item.description}
          display={item.description}
          disabled={!editable}
          onSave={(next) => save({ description: next })}
          className="text-text-primary min-w-0"
          ariaLabel={`Description for ${item.item_code}`}
        />
      </span>
      <span className="min-w-0">
        <BoqSourceBadge source={item.source} />
      </span>
      <BoqEditableCell
        value={item.unit}
        display={item.unit}
        disabled={!editable}
        onSave={(next) => save({ unit: next })}
        className="text-xs text-text-muted"
        ariaLabel={`Unit for ${item.item_code}`}
      />
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
