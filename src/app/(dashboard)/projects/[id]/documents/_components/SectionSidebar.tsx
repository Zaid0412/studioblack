"use client";

import { useMemo } from "react";
import {
  Plus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { DbProjectDocumentSection } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { getSectionIcon } from "./icons";

interface SectionSidebarProps {
  sections: DbProjectDocumentSection[];
  /** `null` = "All documents" view, otherwise a specific section id. */
  activeSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
  onCreate: () => void;
  onRename: (section: DbProjectDocumentSection) => void;
  onDelete: (section: DbProjectDocumentSection) => void;
  onMove: (section: DbProjectDocumentSection, direction: "up" | "down") => void;
  canEdit: boolean;
}

/**
 * Left column. First entry is the "All documents" pseudo-section (activeSectionId
 * = null). Below that, the project's real sections with a "..." menu per row
 * for rename / reorder / delete. "+ New section" sits at the bottom and is
 * hidden for read-only roles.
 */
export function SectionSidebar({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onMove,
  canEdit,
}: SectionSidebarProps) {
  const totalCount = useMemo(
    () => sections.reduce((acc, s) => acc + s.doc_count, 0),
    [sections]
  );
  // Sort once so "Move up / down" computes neighbors against the same order
  // the user sees in the list.
  const sortedSections = useMemo(() => {
    return [...sections].sort(
      (a, b) =>
        a.position - b.position || a.created_at.localeCompare(b.created_at)
    );
  }, [sections]);
  const allActive = activeSectionId === null;
  return (
    <aside className="w-[280px] shrink-0 border-r border-border-default bg-bg-primary flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <p className="text-[11px] font-semibold tracking-wider text-text-muted">
          SECTIONS
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 pb-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={allActive ? "page" : undefined}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-colors ${
            allActive
              ? "bg-bg-elevated text-text-primary font-semibold"
              : "text-text-secondary hover:bg-bg-elevated"
          }`}
        >
          <LayoutGrid
            className={`w-4 h-4 shrink-0 ${allActive ? "text-text-primary" : "text-text-muted"}`}
          />
          <span className="text-[13px] truncate flex-1">All documents</span>
          <span className="text-xs text-text-muted">{totalCount}</span>
        </button>
        {sortedSections.map((section, idx) => {
          const Icon = getSectionIcon(section.icon);
          const active = section.id === activeSectionId;
          const isFirst = idx === 0;
          const isLast = idx === sortedSections.length - 1;
          return (
            <div
              key={section.id}
              className={`group relative flex items-center rounded-md transition-colors ${
                active ? "bg-bg-elevated" : "hover:bg-bg-elevated"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left flex-1 min-w-0 ${
                  active
                    ? "text-text-primary font-semibold"
                    : "text-text-secondary"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "text-text-primary" : "text-text-muted"}`}
                />
                <span className="text-[13px] truncate flex-1">
                  {section.name}
                </span>
                <span className="text-xs text-text-muted">
                  {section.doc_count}
                </span>
              </button>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 p-1.5 mr-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary transition-opacity"
                      aria-label={`More actions for ${section.name}`}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuItem onSelect={() => onRename(section)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isFirst}
                      onSelect={() => onMove(section, "up")}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isLast}
                      onSelect={() => onMove(section, "down")}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onSelect={() => onDelete(section)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        {canEdit && (
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-left text-text-primary hover:bg-bg-elevated transition-colors mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">New section</span>
          </button>
        )}
      </nav>
    </aside>
  );
}
