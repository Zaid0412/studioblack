"use client";

import { memo, useMemo, useState } from "react";
import {
  ChevronRight,
  FolderInput,
  Grip,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DbProjectDocumentSection } from "@/types";
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
import { cn } from "@/lib/utils";
import { SectionIcon } from "./SectionIcon";
import { buildSectionTree, isTopLevel } from "./sectionTree";

interface SectionSidebarProps {
  sections: DbProjectDocumentSection[];
  /** `null` = "All documents" view, otherwise a specific section id. */
  activeSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
  /** Open the create-section dialog. `parentId` pre-fills the parent picker. */
  onCreate: (parentId?: string | null) => void;
  onRename: (section: DbProjectDocumentSection) => void;
  onDelete: (section: DbProjectDocumentSection) => void;
  /**
   * Fires when the user drops a section in a new position WITHIN ITS OWN
   * SIBLING GROUP. `parentId` identifies the group (null = top-level); the
   * id array is the new ordered list of that group's section ids.
   */
  onReorder: (parentId: string | null, orderedIds: string[]) => void;
  /**
   * Move a section to a different parent (or back to top-level when
   * `parentId` is null). Used by the kebab "Move to…" submenu.
   */
  onMove: (section: DbProjectDocumentSection, parentId: string | null) => void;
  canEdit: boolean;
}

/**
 * Left column. "All documents" pseudo-section sits at the top. Below it,
 * sections render as a one-level-deep tree: parents with a chevron, children
 * indented under their expanded parent. Editors can drag-to-reorder within
 * the same sibling group; cross-level moves go through the kebab "Move to…"
 * submenu. "+ New section" stays at the bottom.
 */
export function SectionSidebar({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onMove,
  canEdit,
}: SectionSidebarProps) {
  // Avoid double-counting children whose docs are already rolled up into
  // their parent's doc_count.
  const totalCount = useMemo(
    () =>
      sections.reduce((acc, s) => (isTopLevel(s) ? acc + s.doc_count : acc), 0),
    [sections]
  );
  const { topLevel, childrenByParent, byId } = useMemo(
    () => buildSectionTree(sections),
    [sections]
  );
  // User-toggled collapse overlay. Defaults to "everything expanded"; the
  // active section's parent is force-included in the expanded set on render
  // so the leaf is always visible without a useEffect.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Lazy-mount: don't spin up a per-parent DndContext + SortableContext
  // until the parent has been expanded at least once. Subsequent collapses
  // keep the wrapper mounted so the close animation still has DOM to play
  // against.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const activeParentId = activeSectionId
    ? (byId.get(activeSectionId)?.parent_id ?? null)
    : null;

  function isExpanded(parentId: string): boolean {
    if (parentId === activeParentId) return true;
    return !collapsed.has(parentId);
  }

  function toggleCollapsed(id: string) {
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setOpened((cur) => (cur.has(id) ? cur : new Set(cur).add(id)));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allActive = activeSectionId === null;
  return (
    <aside className="w-[280px] shrink-0 border-r border-border-default bg-bg-primary flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <p className="text-[11px] font-semibold tracking-wider text-text-muted">
          SECTIONS
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 pb-2">
        <div
          className={cn(
            "relative flex items-center rounded-md transition-colors",
            allActive ? "bg-bg-elevated" : "hover:bg-bg-elevated"
          )}
        >
          <span aria-hidden className="w-5 h-5 ml-1.5 shrink-0" />
          <span className="relative w-4 h-4 shrink-0 my-2.5">
            <LayoutGrid
              className={cn(
                "w-4 h-4",
                allActive ? "text-text-primary" : "text-text-muted"
              )}
            />
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-current={allActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 pl-2.5 pr-3 py-2.5 rounded-md text-left flex-1 min-w-0 cursor-pointer",
              allActive
                ? "text-text-primary font-semibold"
                : "text-text-secondary"
            )}
          >
            <span className="text-[13px] truncate flex-1">All documents</span>
            <span className="text-xs text-text-muted">{totalCount}</span>
          </button>
          {canEdit && (
            <span aria-hidden className="p-1.5 mr-1 invisible">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        <SiblingSortable
          ids={topLevel.map((s) => s.id)}
          onReorderedIds={(ids) => onReorder(null, ids)}
          sensors={sensors}
        >
          {topLevel.map((parent) => {
            const children = childrenByParent.get(parent.id) ?? [];
            const hasChildren = children.length > 0;
            const expanded = hasChildren && isExpanded(parent.id);
            // Auto-expanded active parent counts as "opened" too — its
            // DndContext mounts on the first render that needs it.
            const mountChildren =
              hasChildren &&
              (expanded ||
                opened.has(parent.id) ||
                parent.id === activeParentId);
            // A parent with its own children can't be reparented (would create
            // grandchildren). Empty targets → kebab hides the Move-to submenu.
            const parentMoveTargets = hasChildren
              ? []
              : topLevel.filter((t) => t.id !== parent.id);
            const childMoveTargets = topLevel.filter((t) => t.id !== parent.id);
            return (
              <div key={parent.id}>
                <SortableSectionRow
                  section={parent}
                  active={parent.id === activeSectionId}
                  canEdit={canEdit}
                  canReorder={topLevel.length > 1}
                  hasChildren={hasChildren}
                  isExpanded={expanded}
                  onToggle={
                    hasChildren ? () => toggleCollapsed(parent.id) : undefined
                  }
                  onSelect={() => onSelect(parent.id)}
                  onRename={() => onRename(parent)}
                  onDelete={() => onDelete(parent)}
                  onAddSubSection={() => onCreate(parent.id)}
                  moveTargets={parentMoveTargets}
                  isAtTopLevel
                  onMoveToTopLevel={() => onMove(parent, null)}
                  onMoveToParent={(p) => onMove(parent, p.id)}
                />
                {mountChildren && (
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                    aria-hidden={!expanded}
                  >
                    <div className="overflow-hidden">
                      <SiblingSortable
                        ids={children.map((c) => c.id)}
                        onReorderedIds={(ids) => onReorder(parent.id, ids)}
                        sensors={sensors}
                      >
                        {children.map((child) => (
                          <SortableSectionRow
                            key={child.id}
                            section={child}
                            active={child.id === activeSectionId}
                            canEdit={canEdit}
                            canReorder={children.length > 1}
                            nested
                            onSelect={() => onSelect(child.id)}
                            onRename={() => onRename(child)}
                            onDelete={() => onDelete(child)}
                            moveTargets={childMoveTargets}
                            isAtTopLevel={false}
                            onMoveToTopLevel={() => onMove(child, null)}
                            onMoveToParent={(p) => onMove(child, p.id)}
                          />
                        ))}
                      </SiblingSortable>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </SiblingSortable>

        {canEdit && (
          <button
            type="button"
            onClick={() => onCreate(null)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-left text-text-primary hover:bg-bg-elevated transition-colors mt-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">New section</span>
          </button>
        )}
      </nav>
    </aside>
  );
}

/**
 * Wraps a group of siblings (top-level or children of one parent) in its
 * own SortableContext + DndContext so drag-to-reorder is scoped to that
 * level — sections can't accidentally jump between levels via drag.
 */
function SiblingSortable({
  ids,
  onReorderedIds,
  sensors,
  children,
}: {
  ids: string[];
  onReorderedIds: (ids: string[]) => void;
  sensors: ReturnType<typeof useSensors>;
  children: React.ReactNode;
}) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderedIds(arrayMove(ids, oldIndex, newIndex));
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function SortableSectionRowInner({
  section,
  active,
  canEdit,
  canReorder,
  hasChildren = false,
  isExpanded = false,
  onToggle,
  nested = false,
  onSelect,
  onRename,
  onDelete,
  onAddSubSection,
  moveTargets,
  isAtTopLevel,
  onMoveToTopLevel,
  onMoveToParent,
}: {
  section: DbProjectDocumentSection;
  active: boolean;
  canEdit: boolean;
  /**
   * False when this row is the only member of its sibling group — drag-to-
   * reorder is meaningless, so we skip the grip on hover.
   */
  canReorder: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  nested?: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddSubSection?: () => void;
  moveTargets: DbProjectDocumentSection[];
  isAtTopLevel: boolean;
  onMoveToTopLevel: () => void;
  onMoveToParent: (parent: DbProjectDocumentSection) => void;
}) {
  const draggable = canEdit && canReorder;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: !draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center rounded-md transition-colors",
        active ? "bg-bg-elevated" : "hover:bg-bg-elevated",
        isDragging && "z-10 opacity-60"
      )}
    >
      {nested ? (
        // Indent matches the tree-picker dropdown's child rows.
        <span aria-hidden className="w-12 shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasChildren}
          aria-label={
            hasChildren
              ? isExpanded
                ? `Collapse ${section.name}`
                : `Expand ${section.name}`
              : undefined
          }
          className={cn(
            "w-5 h-5 ml-1.5 flex items-center justify-center shrink-0 rounded transition-colors",
            hasChildren
              ? "text-text-muted hover:text-text-primary hover:bg-bg-input cursor-pointer"
              : "invisible"
          )}
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </button>
      )}
      <span className="relative w-4 h-4 shrink-0 my-2.5">
        <SectionIcon
          icon={section.icon}
          className={cn(
            "absolute inset-0 w-4 h-4 transition-opacity pointer-events-none",
            draggable && "group-hover:opacity-0",
            active ? "text-text-primary" : "text-text-muted"
          )}
        />
        {draggable && (
          <button
            {...attributes}
            {...listeners}
            type="button"
            aria-label={`Drag to reorder ${section.name}`}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-text-primary touch-none"
          >
            <Grip className="w-4 h-4" />
          </button>
        )}
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 pl-2.5 pr-3 py-2.5 rounded-md text-left flex-1 min-w-0 cursor-pointer",
          active ? "text-text-primary font-semibold" : "text-text-secondary"
        )}
      >
        <span className="text-[13px] truncate flex-1">{section.name}</span>
        <span className="text-xs text-text-muted">{section.doc_count}</span>
      </button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 p-1.5 mr-1 rounded text-text-muted hover:text-text-primary transition-opacity cursor-pointer"
              aria-label={`More actions for ${section.name}`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </DropdownMenuItem>
            {onAddSubSection && (
              <DropdownMenuItem onSelect={onAddSubSection}>
                <Plus className="w-3.5 h-3.5" />
                Add sub-section
              </DropdownMenuItem>
            )}
            {(moveTargets.length > 0 || !isAtTopLevel) && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="w-3.5 h-3.5" />
                  Move to…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px] max-h-[260px] overflow-y-auto">
                  {!isAtTopLevel && (
                    <DropdownMenuItem onSelect={onMoveToTopLevel}>
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Top-level
                    </DropdownMenuItem>
                  )}
                  {!isAtTopLevel && moveTargets.length > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  {moveTargets.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => onMoveToParent(t)}
                    >
                      <SectionIcon
                        icon={t.icon}
                        className="w-3.5 h-3.5 text-text-secondary"
                      />
                      <span className="truncate">{t.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * Memo skips re-renders when only callbacks changed (the parent reconstructs
 * `onSelect`/`onMove`/... per render). `moveTargets` is a freshly-filtered
 * array on every parent render but rarely changes in content; compare by
 * length + first/last id as a cheap stand-in for deep equality.
 */
const SortableSectionRow = memo(
  SortableSectionRowInner,
  (prev, next) =>
    prev.section === next.section &&
    prev.active === next.active &&
    prev.canEdit === next.canEdit &&
    prev.canReorder === next.canReorder &&
    prev.hasChildren === next.hasChildren &&
    prev.isExpanded === next.isExpanded &&
    prev.nested === next.nested &&
    prev.isAtTopLevel === next.isAtTopLevel &&
    prev.moveTargets.length === next.moveTargets.length &&
    prev.moveTargets[0]?.id === next.moveTargets[0]?.id &&
    prev.moveTargets[prev.moveTargets.length - 1]?.id ===
      next.moveTargets[next.moveTargets.length - 1]?.id
);
