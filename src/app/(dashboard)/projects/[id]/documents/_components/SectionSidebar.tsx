"use client";

import { useMemo } from "react";
import {
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
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/utils";
import { SectionIcon } from "./SectionIcon";

interface SectionSidebarProps {
  sections: DbProjectDocumentSection[];
  /** `null` = "All documents" view, otherwise a specific section id. */
  activeSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
  onCreate: () => void;
  onRename: (section: DbProjectDocumentSection) => void;
  onDelete: (section: DbProjectDocumentSection) => void;
  /**
   * Fires when the user drops a section in a new position. The array is the
   * full ordered list of section ids in their new positions; the caller is
   * expected to persist the order (e.g. via per-section PATCH writes).
   */
  onReorder: (orderedIds: string[]) => void;
  canEdit: boolean;
}

/**
 * Left column. First entry is the "All documents" pseudo-section (activeSectionId
 * = null). Below that, the project's real sections — drag-sortable for editors
 * (the section icon swaps to a grip handle on hover). "+ New section" sits at
 * the bottom and is hidden for read-only roles.
 */
export function SectionSidebar({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  canEdit,
}: SectionSidebarProps) {
  const totalCount = useMemo(
    () => sections.reduce((acc, s) => acc + s.doc_count, 0),
    [sections]
  );
  const sortedSections = useMemo(() => {
    return [...sections].sort(
      (a, b) =>
        a.position - b.position || a.created_at.localeCompare(b.created_at)
    );
  }, [sections]);
  const sortedIds = useMemo(
    () => sortedSections.map((s) => s.id),
    [sortedSections]
  );
  const sensors = useSensors(
    // Activation distance prevents drags from firing on accidental click-and-
    // release on the grip handle — a real reorder needs a small movement.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedIds.indexOf(String(active.id));
    const newIndex = sortedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(sortedIds, oldIndex, newIndex));
  }

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
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-current={allActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left flex-1 min-w-0 cursor-pointer",
              allActive
                ? "text-text-primary font-semibold"
                : "text-text-secondary"
            )}
          >
            <LayoutGrid
              className={cn(
                "w-4 h-4 shrink-0",
                allActive ? "text-text-primary" : "text-text-muted"
              )}
            />
            <span className="text-[13px] truncate flex-1">All documents</span>
            <span className="text-xs text-text-muted">{totalCount}</span>
          </button>
          {canEdit && (
            // Invisible placeholder matching the section "..." menu so the
            // count column aligns across all rows.
            <span aria-hidden className="p-1.5 mr-1 invisible">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedIds}
            strategy={verticalListSortingStrategy}
          >
            {sortedSections.map((section) => (
              <SortableSectionRow
                key={section.id}
                section={section}
                active={section.id === activeSectionId}
                canEdit={canEdit}
                onSelect={() => onSelect(section.id)}
                onRename={() => onRename(section)}
                onDelete={() => onDelete(section)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {canEdit && (
          <button
            type="button"
            onClick={onCreate}
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

function SortableSectionRow({
  section,
  active,
  canEdit,
  onSelect,
  onRename,
  onDelete,
}: {
  section: DbProjectDocumentSection;
  active: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: !canEdit });

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
      {/* Icon cell — section icon by default, swaps to a drag handle on
          hover. Both share the same slot so the row layout never shifts.
          Kept as a SIBLING of the select button (not a child) so dnd-kit's
          pointer listeners aren't competing with the button's click. */}
      <span className="relative w-4 h-4 shrink-0 ml-3 my-2.5">
        <SectionIcon
          icon={section.icon}
          className={cn(
            "absolute inset-0 w-4 h-4 transition-opacity pointer-events-none",
            canEdit && "group-hover:opacity-0",
            active ? "text-text-primary" : "text-text-muted"
          )}
        />
        {canEdit && (
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
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </DropdownMenuItem>
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
