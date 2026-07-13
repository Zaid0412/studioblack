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
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
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
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { SectionSelectionState } from "@/hooks/useBoqSelection";
import type {
  BoqItemWithComputed,
  BoqSection,
  BoqSummary,
  UserRole,
} from "@/types";
import { type BoqItemPhase, type ElementUnit } from "@/lib/validations";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { isExternalViewer } from "@/lib/roles";
import {
  BOQ_NO_SECTION_ID,
  formatCurrency,
  formatDimensions,
  formatLibraryName,
  formatOptionalCurrency,
  formatPct,
  formatQty,
  getLegalPhaseTransitions,
  isDestructivePhase,
  parseOptionalNumber,
  phaseToLabel,
  phaseToVariant,
  marginTier,
  toNum,
} from "../_lib/formatters";
import { BoqChangeRequestDialog } from "./BoqChangeRequestDialog";
import { BoqSectionHeader } from "./BoqSectionHeader";
import { BoqSectionFooter } from "./BoqSectionFooter";
import { BoqSectionChips, type BoqChipDescriptor } from "./BoqSectionChips";
import { BoqEditableCell } from "./BoqEditableCell";
import { BoqSourceBadge } from "./BoqSourceBadge";
import { CurrentBadge } from "./BoqMoveTargetPopover";
import type { UpdateItemPayload } from "@/lib/api/boq";
import type { BoqItemSource } from "@/lib/validations";

interface BoqTableProps {
  sections: BoqSection[];
  items: BoqItemWithComputed[];
  summary: BoqSummary;
  currency: string;
  minimumMarginPct: string;
  canEdit: boolean;
  /** Viewer's role — gates the row menu's "Change lifecycle…" submenu per the server permission matrix. */
  role: UserRole | null;
  /** Current viewer's user id — used to derive `isCreator`. */
  currentUserId: string | null;
  /** BOQ.created_by — used to derive `isCreator` for the 4-eyes rule. */
  boqCreatorId: string | null;
  /** When set, only items whose `source` is in the set are rendered. Empty/undefined → no filter. */
  sourceFilter?: ReadonlySet<BoqItemSource>;
  onUpdateItem?: (
    itemId: string,
    data: UpdateItemPayload
  ) => Promise<BoqItemWithComputed | null | undefined>;
  onDeleteItem?: (item: BoqItemWithComputed) => Promise<void>;
  /** Open the apply-rate-contract dialog for this item (handled at page level). */
  onApplyRate?: (item: BoqItemWithComputed) => void;
  /** Move `item` to `targetSectionId` (`null` = Unassigned bucket). */
  onMoveItem?: (
    item: BoqItemWithComputed,
    targetSectionId: string | null
  ) => Promise<BoqItemWithComputed | null | undefined>;
  /** Surfaces "+ Create new section…" at the bottom of the row's Move sub-menu. */
  onCreateAndMoveItem?: (item: BoqItemWithComputed) => void;
  /**
   * Fire a phase transition on a single item from the row's "..." menu.
   * `comment` is required for destructive phases (`*_changes_requested`);
   * the menu captures it via `BoqChangeRequestDialog` before calling.
   */
  onSetItemPhase?: (
    item: BoqItemWithComputed,
    target: BoqItemPhase,
    comment?: string
  ) => Promise<unknown> | void;
  onRenameSection?: (section: BoqSection) => void;
  onToggleSectionVisibility?: (section: BoqSection) => void;
  onDeleteSection?: (section: BoqSection) => void;
  onAddItemToSection?: (sectionId: string | null) => void;
  /** Opens the element-library picker for adding to a specific section. */
  onAddFromLibraryToSection?: (sectionId: string | null) => void;
  onReorderSections?: (orderedIds: string[]) => void;
  onOpenItem?: (item: BoqItemWithComputed) => void;
  /** Optional — when supplied, renders a leading checkbox column for bulk-select mode. */
  selection?: SelectionApi;
}

/**
 * Subset of `useBoqSelection`'s return surface the table needs. Lifted
 * here so consumers (`BoqTab`) instantiate the hook once and pass it down.
 */
export interface SelectionApi {
  selected: Set<string>;
  tableState: SectionSelectionState;
  toggle: (id: string) => void;
  toggleAll: () => void;
  toggleSection: (sectionId: string | null) => void;
  sectionState: (sectionId: string | null) => SectionSelectionState;
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
// Client Rate + Budget Rate are 90px each, sitting between Proposed Price
// (cost build-up output) and Phase (single unified workflow badge).
export const GRID_COLS =
  "grid-cols-[70px_minmax(160px,1fr)_72px_50px_70px_90px_100px_75px_100px_90px_90px_160px_32px]";

// Same as GRID_COLS with a leading 32px checkbox column for bulk select.
const GRID_COLS_WITH_SELECT =
  "grid-cols-[32px_70px_minmax(160px,1fr)_72px_50px_70px_90px_100px_75px_100px_90px_90px_160px_32px]";

// External-viewer variant (client + vendor) — drops Source / Unit Cost /
// Total Cost / Margin / Budget Rate / Client Rate. Leaves Code, Description,
// Unit, Qty, Proposed Price, Phase, Actions.
const GRID_COLS_EXTERNAL =
  "grid-cols-[70px_minmax(160px,1fr)_50px_70px_100px_160px_32px]";

// External-viewer variant with a leading 32px checkbox column for clients
// who've entered bulk-select mode (e.g. to batch-approve items).
const GRID_COLS_EXTERNAL_WITH_SELECT =
  "grid-cols-[32px_70px_minmax(160px,1fr)_50px_70px_100px_160px_32px]";

/**
 * Sum of the fixed column widths above (1159px) plus 12 inter-column gaps
 * (gap-2 = 96px) = 1255px. Applied as `min-w` on the table's scrollable
 * wrapper so columns never squish below their declared sizes; below the
 * threshold the wrapper scrolls horizontally instead, keeping header and
 * rows aligned.
 */
export const TABLE_MIN_WIDTH = "min-w-[1255px]";
// External-viewer table is narrower (7 columns); ease off the wide min-width
// so it renders naturally without horizontal scroll on most viewports.
const TABLE_MIN_WIDTH_EXTERNAL = "min-w-[600px]";

/** BOQ line-item grid: groups items under sortable sections, supports inline edits and item-level actions. */
export function BoqTable({
  sections,
  items,
  summary,
  currency,
  minimumMarginPct,
  canEdit,
  role,
  currentUserId,
  boqCreatorId,
  sourceFilter,
  onUpdateItem,
  onDeleteItem,
  onApplyRate,
  onMoveItem,
  onCreateAndMoveItem,
  onSetItemPhase,
  selection,
  onRenameSection,
  onToggleSectionVisibility,
  onDeleteSection,
  onAddItemToSection,
  onAddFromLibraryToSection,
  onReorderSections,
  onOpenItem,
}: BoqTableProps) {
  const t = useTranslations("boq.table");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // One dialog per table, not per row — captures both the row and which
  // destructive phase was picked (internal vs client variant).
  const [changeRequestTarget, setChangeRequestTarget] = useState<{
    item: BoqItemWithComputed;
    target: BoqItemPhase;
  } | null>(null);
  // Stable identity so it doesn't defeat BoqItemRow's memo (only a setter).
  const handleRequestChangeComment = useCallback(
    (item: BoqItemWithComputed, target: BoqItemPhase) =>
      setChangeRequestTarget({ item, target }),
    []
  );
  const marginFloor = toNum(minimumMarginPct) || undefined;
  const rowsEditable = canEdit && !!onUpdateItem;
  const sectionsEditable = canEdit;
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

  const listRef = useStaggerReveal<HTMLDivElement>(
    visibleItems.map((i) => i.id).join(",")
  );

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

  const isExternal = isExternalViewer(role);
  // Clients see a trimmed table: no cost / margin / budget / source columns.
  // Server already scrubs those numbers from the payload, but hiding the
  // columns avoids confusing zeros in the UI.
  const gridCols = isExternal
    ? selection
      ? GRID_COLS_EXTERNAL_WITH_SELECT
      : GRID_COLS_EXTERNAL
    : selection
      ? GRID_COLS_WITH_SELECT
      : GRID_COLS;
  const wrapperMinWidth = isExternal
    ? TABLE_MIN_WIDTH_EXTERNAL
    : TABLE_MIN_WIDTH;

  return (
    <>
      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <BoqSectionChips
          chips={chips}
          getSectionEl={getSectionEl}
          onActivate={expandSection}
        />
        <div className="overflow-x-auto">
          <div ref={listRef} className={wrapperMinWidth}>
            <div
              className={`grid ${gridCols} gap-2 px-3 py-3 border-b border-border-default text-[11px] font-bold text-text-primary uppercase tracking-wide`}
            >
              {selection && (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={selection.tableState === "all"}
                    indeterminate={selection.tableState === "some"}
                    onCheckedChange={() => selection.toggleAll()}
                    aria-label="Select all visible items"
                  />
                </div>
              )}
              <div>Code</div>
              <div>Description</div>
              {!isExternal && <div>{t("columnSource")}</div>}
              <div>Unit</div>
              <div className="text-right">Qty</div>
              {!isExternal && <div className="text-right">Unit Cost</div>}
              {!isExternal && <div className="text-right">Total Cost</div>}
              {!isExternal && <div className="text-right">Margin</div>}
              <div className="text-right">{t("columnProposedPrice")}</div>
              {!isExternal && <div className="text-right">Client Rate</div>}
              {!isExternal && <div className="text-right">Budget Rate</div>}
              <div className="text-center pl-3">Phase</div>
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
              role={role}
              currentUserId={currentUserId}
              boqCreatorId={boqCreatorId}
              registerSectionRef={registerSectionRef}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onApplyRate={onApplyRate}
              onMoveItem={onMoveItem}
              onCreateAndMoveItem={onCreateAndMoveItem}
              onSetItemPhase={onSetItemPhase}
              onRequestChangeComment={handleRequestChangeComment}
              selection={selection}
              onOpenItem={onOpenItem}
              onAddItemToSection={onAddItemToSection}
              onAddFromLibraryToSection={onAddFromLibraryToSection}
              onRenameSection={onRenameSection}
              onToggleSectionVisibility={onToggleSectionVisibility}
              onDeleteSection={onDeleteSection}
              onReorderSections={onReorderSections}
            />
          </div>
        </div>
      </div>
      <BoqChangeRequestDialog
        open={changeRequestTarget !== null}
        onOpenChange={(open) => {
          if (!open) setChangeRequestTarget(null);
        }}
        onSubmit={async (comment) => {
          const pending = changeRequestTarget;
          if (!pending || !onSetItemPhase) return;
          await onSetItemPhase(pending.item, pending.target, comment);
          setChangeRequestTarget(null);
        }}
      />
    </>
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
  role: UserRole | null;
  currentUserId: string | null;
  boqCreatorId: string | null;
  registerSectionRef: (id: string, el: HTMLElement | null) => void;
  onUpdateItem?: BoqTableProps["onUpdateItem"];
  onDeleteItem?: BoqTableProps["onDeleteItem"];
  onApplyRate?: BoqTableProps["onApplyRate"];
  onMoveItem?: BoqTableProps["onMoveItem"];
  onCreateAndMoveItem?: BoqTableProps["onCreateAndMoveItem"];
  onSetItemPhase?: BoqTableProps["onSetItemPhase"];
  onRequestChangeComment?: (
    item: BoqItemWithComputed,
    target: BoqItemPhase
  ) => void;
  selection?: BoqTableProps["selection"];
  onOpenItem?: BoqTableProps["onOpenItem"];
  onAddItemToSection?: BoqTableProps["onAddItemToSection"];
  onAddFromLibraryToSection?: BoqTableProps["onAddFromLibraryToSection"];
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
  sections,
  currency,
  marginFloor,
  collapsed,
  setCollapsed,
  rowsEditable,
  sectionsEditable,
  role,
  currentUserId,
  boqCreatorId,
  registerSectionRef,
  onUpdateItem,
  onDeleteItem,
  onApplyRate,
  onMoveItem,
  onCreateAndMoveItem,
  onSetItemPhase,
  onRequestChangeComment,
  selection,
  onOpenItem,
  onAddItemToSection,
  onAddFromLibraryToSection,
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
          onAddCustomItem={
            sectionsEditable && onAddItemToSection
              ? () => onAddItemToSection(section?.id ?? null)
              : undefined
          }
          onAddFromLibrary={
            sectionsEditable && onAddFromLibraryToSection
              ? () => onAddFromLibraryToSection(section?.id ?? null)
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
          selectionState={
            selection ? selection.sectionState(section?.id ?? null) : undefined
          }
          onToggleSelection={
            selection
              ? () => selection.toggleSection(section?.id ?? null)
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
              editable={rowsEditable}
              sections={sections}
              role={role}
              currentUserId={currentUserId}
              boqCreatorId={boqCreatorId}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onApplyRate={onApplyRate}
              onMoveItem={onMoveItem}
              onCreateAndMoveItem={onCreateAndMoveItem}
              onSetItemPhase={onSetItemPhase}
              onRequestChangeComment={onRequestChangeComment}
              isSelected={selection ? selection.selected.has(item.id) : false}
              onToggleSelected={selection?.toggle}
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
  /** Viewer's role — drives lifecycle submenu visibility/per-phase gating. */
  role: UserRole | null;
  currentUserId: string | null;
  boqCreatorId: string | null;
  onUpdateItem?: (
    itemId: string,
    data: UpdateItemPayload
  ) => Promise<BoqItemWithComputed | null | undefined>;
  onDeleteItem?: (item: BoqItemWithComputed) => Promise<void>;
  /** Open the apply-rate-contract dialog for this item (handled at page level). */
  onApplyRate?: (item: BoqItemWithComputed) => void;
  onMoveItem?: (
    item: BoqItemWithComputed,
    targetSectionId: string | null
  ) => Promise<BoqItemWithComputed | null | undefined>;
  /** All sections in this BOQ — surfaced in the row's "Move to section…" sub-menu. */
  sections: BoqSection[];
  /** When defined, renders a leading checkbox column. */
  isSelected?: boolean;
  onToggleSelected?: (id: string) => void;
  /** When defined, adds a "+ Create new section…" item at the bottom of the Move sub-menu. */
  onCreateAndMoveItem?: (item: BoqItemWithComputed) => void;
  /** Fire a single-item phase transition from the row's "..." menu. */
  onSetItemPhase?: (
    item: BoqItemWithComputed,
    target: BoqItemPhase,
    comment?: string
  ) => Promise<unknown> | void;
  /**
   * Request the table-level change-request comment prompt for `item`. Used
   * for destructive transitions so the dialog is mounted once at the table
   * level instead of once per row.
   */
  onRequestChangeComment?: (
    item: BoqItemWithComputed,
    target: BoqItemPhase
  ) => void;
  onOpen?: (item: BoqItemWithComputed) => void;
}

const BoqItemRow = memo(function BoqItemRow({
  item,
  currency,
  marginFloor,
  editable,
  sections,
  role,
  currentUserId,
  boqCreatorId,
  onUpdateItem,
  onDeleteItem,
  onApplyRate,
  onMoveItem,
  isSelected,
  onToggleSelected,
  onCreateAndMoveItem,
  onSetItemPhase,
  onRequestChangeComment,
  onOpen,
}: BoqItemRowProps) {
  const selectionMode = onToggleSelected !== undefined;
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

  // Pre-compute the dimensions subscript so the formatter doesn't run
  // inline in JSX on every render (cheap per row, but a 500-line BoQ
  // would do 500× per render otherwise).
  const dimensionsLabel = useMemo(
    () =>
      formatDimensions(
        item.length,
        item.breadth,
        item.height,
        item.dimension_unit
      ),
    [item.length, item.breadth, item.height, item.dimension_unit]
  );

  const canMove = editable && !!onMoveItem;
  const isExternal = isExternalViewer(role);
  // Phases the viewer can actually transition this item into right now —
  // intersect the legal-from-current-phase set with the role-permission set,
  // so a PM viewing `internal_review` doesn't see "Send to Client" (legal
  // for the role but not from that phase).
  const lifecycleTargets = onSetItemPhase
    ? getLegalPhaseTransitions(item.phase, {
        role,
        actorId: currentUserId,
        boqCreatorId,
      })
    : [];
  const canChangeLifecycle = lifecycleTargets.length > 0;
  // Clients only get menu access for lifecycle actions; PMs/architects keep
  // their existing move/delete entries gated on `editable`.
  const canApplyRate = editable && !!onApplyRate && !!item.element_id;
  const showMenu =
    (editable && (onDeleteItem || canMove)) ||
    canChangeLifecycle ||
    canApplyRate;
  const currentSectionId = item.section_id ?? null;

  const handlePickLifecycle = (target: BoqItemPhase) => {
    if (!onSetItemPhase) return;
    if (isDestructivePhase(target)) {
      onRequestChangeComment?.(item, target);
      return;
    }
    void onSetItemPhase(item, target);
  };

  const rowGridCols = isExternal
    ? selectionMode
      ? GRID_COLS_EXTERNAL_WITH_SELECT
      : GRID_COLS_EXTERNAL
    : selectionMode
      ? GRID_COLS_WITH_SELECT
      : GRID_COLS;

  return (
    <div
      data-anim-item
      className={`grid ${rowGridCols} gap-2 px-3 py-3 items-center border-b border-border-default last:border-b-0 text-sm hover:bg-bg-elevated/50 transition-colors ${isSelected ? "bg-accent/5" : ""}`}
    >
      {selectionMode && (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected ?? false}
            onCheckedChange={() => onToggleSelected?.(item.id)}
            aria-label={`Select ${item.item_code}`}
          />
        </div>
      )}
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
      <span className="flex flex-col gap-0.5 min-w-0">
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
        {item.element_name && item.element_name !== item.description && (
          <span className="text-[11px] text-text-muted truncate">
            <span className="opacity-70">From library:</span>{" "}
            {formatLibraryName(item.element_name, item.element_archived)}
          </span>
        )}
        {dimensionsLabel && (
          <span className="text-[11px] italic text-text-muted truncate">
            {dimensionsLabel}
          </span>
        )}
      </span>
      {!isExternal && (
        <span className="min-w-0">
          <BoqSourceBadge source={item.source} />
        </span>
      )}
      {/* A picker, not a free-text cell: this column was the one unit input in
          the app that didn't clamp to ALLOWED_UNITS, which is how a line ended
          up as "nos" — accepted here, then rejected by its own BOQ's re-import. */}
      <UnitSelect
        value={item.unit as ElementUnit}
        onChange={(next) => save({ unit: next })}
        disabled={!editable}
        compact
        triggerClassName="border-none bg-transparent px-0 text-xs text-text-muted hover:bg-surface-hover"
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
      {!isExternal && (
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
      )}
      {!isExternal && (
        <span className="text-right tabular-nums text-text-primary">
          {formatCurrency(item.total_cost, currency)}
        </span>
      )}
      {!isExternal && (
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
      )}
      <span className="text-right tabular-nums text-text-primary">
        {formatCurrency(item.sell_price, currency)}
      </span>
      {!isExternal && (
        <BoqEditableCell
          value={item.client_rate ?? ""}
          display={formatOptionalCurrency(item.client_rate, currency)}
          mode="number"
          min={0}
          align="right"
          disabled={!editable}
          onSave={(next) => save({ clientRate: parseOptionalNumber(next) })}
          className="tabular-nums text-text-primary"
          ariaLabel={`Client rate for ${item.item_code}`}
        />
      )}
      {!isExternal && (
        <span
          className={`text-right tabular-nums flex items-center justify-end gap-1 ${
            item.over_budget ? "text-error font-medium" : "text-text-primary"
          }`}
          title={
            item.over_budget && item.budget_variance_pct !== null
              ? `Cost is ${item.budget_variance_pct}% over the budget rate.`
              : undefined
          }
        >
          {item.over_budget && <AlertTriangle className="w-3.5 h-3.5" />}
          <BoqEditableCell
            value={item.budget_rate ?? ""}
            display={formatOptionalCurrency(item.budget_rate, currency)}
            mode="number"
            min={0}
            align="right"
            disabled={!editable}
            onSave={(next) => save({ budgetRate: parseOptionalNumber(next) })}
            className="tabular-nums"
            ariaLabel={`Budget rate for ${item.item_code}`}
          />
        </span>
      )}
      <span className="min-w-0 flex items-center justify-center pl-3">
        <Badge
          variant={phaseToVariant(item.phase, role)}
          className="!px-2 truncate max-w-full"
        >
          {phaseToLabel(item.phase, role)}
        </Badge>
      </span>
      <span className="flex justify-end pr-3">
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary cursor-pointer"
              aria-label={`Actions for ${item.item_code}`}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canMove && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Move to section…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      disabled={currentSectionId === null}
                      onSelect={() => void onMoveItem!(item, null)}
                    >
                      <span className="flex-1">(Unassigned)</span>
                      {currentSectionId === null && <CurrentBadge />}
                    </DropdownMenuItem>
                    {sections.length > 0 && <DropdownMenuSeparator />}
                    {sections.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        disabled={currentSectionId === s.id}
                        onSelect={() => void onMoveItem!(item, s.id)}
                      >
                        <span className="flex-1 truncate max-w-[220px]">
                          {s.title}
                        </span>
                        {currentSectionId === s.id && <CurrentBadge />}
                      </DropdownMenuItem>
                    ))}
                    {onCreateAndMoveItem && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => onCreateAndMoveItem(item)}
                          className="text-accent focus:text-accent"
                        >
                          + Create new section…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canChangeLifecycle && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Change lifecycle…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {/* Only fireable targets — current phase is on the row badge. */}
                    {lifecycleTargets.map((phase) => (
                      <DropdownMenuItem
                        key={phase}
                        onSelect={() => handlePickLifecycle(phase)}
                        className={
                          isDestructivePhase(phase)
                            ? "text-error focus:text-error"
                            : undefined
                        }
                      >
                        <span className="flex-1">
                          {phaseToLabel(phase, role)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canApplyRate && onApplyRate && (
                <DropdownMenuItem onSelect={() => onApplyRate(item)}>
                  Apply rate contract…
                </DropdownMenuItem>
              )}
              {(canMove || canChangeLifecycle || canApplyRate) &&
                onDeleteItem &&
                editable && <DropdownMenuSeparator />}
              {onDeleteItem && editable && (
                <DropdownMenuItem
                  onSelect={() => void onDeleteItem(item)}
                  className="text-error focus:text-error"
                >
                  Delete item
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </div>
  );
});
