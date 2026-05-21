"use client";

import { Plus, LayoutGrid } from "lucide-react";
import type { DbProjectDocumentSection } from "@/types";
import { getSectionIcon } from "./icons";

interface SectionSidebarProps {
  sections: DbProjectDocumentSection[];
  /** `null` = "All documents" view, otherwise a specific section id. */
  activeSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
  onCreate: () => void;
  canEdit: boolean;
}

/**
 * Left column. First entry is the "All documents" pseudo-section (activeSectionId
 * = null). Below that, the project's real sections. Doc counts on the right
 * edge. "+ New section" sits at the bottom and is hidden for read-only roles.
 */
export function SectionSidebar({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  canEdit,
}: SectionSidebarProps) {
  const totalCount = sections.reduce((acc, s) => acc + s.doc_count, 0);
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
        {sections.map((section) => {
          const Icon = getSectionIcon(section.icon);
          const active = section.id === activeSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-colors ${
                active
                  ? "bg-bg-elevated text-text-primary font-semibold"
                  : "text-text-secondary hover:bg-bg-elevated"
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
