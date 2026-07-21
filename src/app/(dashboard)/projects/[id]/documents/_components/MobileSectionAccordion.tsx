"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LayoutGrid, Plus } from "lucide-react";
import type { DbProjectDocumentSection } from "@/types";
import { cn } from "@/lib/utils";
import { useDismissOnEscape } from "@/hooks/useDismissOnEscape";
import { SectionIcon } from "./SectionIcon";
import { buildSectionTree, isTopLevel } from "./sectionTree";

interface MobileSectionAccordionProps {
  sections: DbProjectDocumentSection[];
  activeSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
  onCreate: () => void;
  canEdit: boolean;
}

/**
 * Mobile-only replacement for `SectionSidebar`. The header acts as a
 * collapsible dropdown showing the active section. Expanding reveals the
 * full section tree inline above the doc list. Tap a row → select + close.
 *
 * Drag-reorder + per-section kebab (rename / move / delete / add sub) live
 * on the desktop sidebar only — they're awkward on touch and easy to defer.
 */
export function MobileSectionAccordion({
  sections,
  activeSectionId,
  onSelect,
  onCreate,
  canEdit,
}: MobileSectionAccordionProps) {
  const [open, setOpen] = useState(false);
  const { topLevel, childrenByParent, byId } = useMemo(
    () => buildSectionTree(sections),
    [sections]
  );
  const totalCount = useMemo(
    () =>
      sections.reduce((acc, s) => (isTopLevel(s) ? acc + s.doc_count : acc), 0),
    [sections]
  );
  const activeSection = activeSectionId ? byId.get(activeSectionId) : null;
  const activeParentId = activeSection?.parent_id ?? null;
  // Default-expand the parent of the active sub-section, like the desktop
  // sidebar. User-toggled collapses are tracked separately.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
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
  }

  function handleSelect(id: string | null) {
    onSelect(id);
    setOpen(false);
  }

  // Escape closes the dropdown; mirrors native <select> + Radix Popover.
  useDismissOnEscape(open, () => setOpen(false));

  const headerLabel = activeSection?.name ?? "All documents";
  const headerCount = activeSection?.doc_count ?? totalCount;

  return (
    <div className="md:hidden border-b border-border-default bg-bg-primary relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between w-full px-4 py-3 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            className={cn(
              "w-4 h-4 text-text-muted shrink-0 transition-transform duration-200",
              !open && "-rotate-90"
            )}
          />
          {activeSection ? (
            <SectionIcon
              icon={activeSection.icon}
              className="w-4 h-4 text-accent-strong shrink-0"
            />
          ) : (
            <LayoutGrid className="w-4 h-4 text-accent-strong shrink-0" />
          )}
          <span className="text-sm font-semibold text-accent-strong truncate">
            {headerLabel}
          </span>
        </div>
        <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-elevated">
          {headerCount}
        </span>
      </button>

      {/* Backdrop — fades in/out, taps close the dropdown. Sits between the
          header and the floating panel so panel taps still register. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-20 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Floating dropdown — absolute so the doc list below doesn't shift. */}
      <div
        className={cn(
          "absolute left-0 right-0 top-full z-30 bg-bg-primary border-b border-border-default shadow-lg origin-top transition-[opacity,transform] duration-200 ease-out",
          open
            ? "opacity-100 scale-y-100"
            : "pointer-events-none opacity-0 scale-y-95"
        )}
        aria-hidden={!open}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <nav className="flex flex-col gap-0.5 px-2 py-2">
            <AccordionRow
              icon={<LayoutGrid className="w-4 h-4" />}
              label="All documents"
              count={totalCount}
              active={activeSectionId === null}
              onClick={() => handleSelect(null)}
            />
            {topLevel.map((parent) => {
              const children = childrenByParent.get(parent.id) ?? [];
              const hasChildren = children.length > 0;
              const expanded = hasChildren && isExpanded(parent.id);
              return (
                <div key={parent.id}>
                  <AccordionRow
                    icon={
                      <SectionIcon icon={parent.icon} className="w-4 h-4" />
                    }
                    label={parent.name}
                    count={parent.doc_count}
                    active={parent.id === activeSectionId}
                    chevron={hasChildren ? (expanded ? "down" : "right") : null}
                    onChevronClick={
                      hasChildren ? () => toggleCollapsed(parent.id) : undefined
                    }
                    onClick={() => handleSelect(parent.id)}
                  />
                  {hasChildren && (
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 ease-out",
                        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      )}
                    >
                      <div className="overflow-hidden">
                        {children.map((child) => (
                          <AccordionRow
                            key={child.id}
                            icon={
                              <SectionIcon
                                icon={child.icon}
                                className="w-4 h-4"
                              />
                            }
                            label={child.name}
                            count={child.doc_count}
                            active={child.id === activeSectionId}
                            nested
                            onClick={() => handleSelect(child.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-md text-left text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[13px] font-medium">New section</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

function AccordionRow({
  icon,
  label,
  count,
  active,
  nested = false,
  chevron = null,
  onChevronClick,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  nested?: boolean;
  chevron?: "down" | "right" | null;
  onChevronClick?: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-md transition-colors",
        active ? "bg-bg-elevated" : "hover:bg-bg-elevated/50",
        nested ? "pl-6" : !chevron && "pl-[30px]"
      )}
    >
      {chevron && onChevronClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChevronClick();
          }}
          aria-label={
            chevron === "down" ? `Collapse ${label}` : `Expand ${label}`
          }
          className="w-7 h-7 ml-0.5 flex items-center justify-center shrink-0 text-text-muted cursor-pointer"
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              chevron === "down" && "rotate-90"
            )}
          />
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2.5 text-left flex-1 min-w-0 cursor-pointer",
          active ? "text-text-primary font-semibold" : "text-text-secondary"
        )}
      >
        <span
          className={cn(
            "shrink-0",
            active ? "text-text-primary" : "text-text-muted"
          )}
        >
          {icon}
        </span>
        <span className="text-[13px] truncate flex-1">{label}</span>
        <span className="text-xs text-text-muted">{count}</span>
      </button>
    </div>
  );
}
