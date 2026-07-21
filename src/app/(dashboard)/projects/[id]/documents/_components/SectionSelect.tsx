"use client";

import { useMemo } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { cn } from "@/lib/utils";
import type { DbProjectDocumentSection } from "@/types";
import { SectionIcon } from "./SectionIcon";
import { buildSectionTree, sectionFullPath } from "./sectionTree";

interface SectionSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  sections: DbProjectDocumentSection[];
  label?: string;
  /** When true, render a red asterisk next to the label. */
  required?: boolean;
  /**
   * Opens the parent's NewSectionDialog. When omitted, the "+ New section"
   * header is hidden (used by NewSectionDialog's own parent picker to avoid
   * recursive "create from create").
   */
  onCreateNew?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * If set, only sections matching this predicate are selectable. Other rows
   * still render (for structure) but are dimmed and ignored on click. Used
   * e.g. by the parent picker in NewSectionDialog to hide already-nested
   * sections.
   */
  isSelectable?: (section: DbProjectDocumentSection) => boolean;
}

/**
 * Picker for assigning a document to one of the project's sections. Renders
 * options as a one-level tree: top-level sections in document order, each
 * followed by its children indented underneath. Searching collapses to a
 * flat filtered list with full-path labels.
 */
export function SectionSelect({
  value,
  onChange,
  sections,
  label,
  required,
  onCreateNew,
  disabled,
  placeholder = "Pick a section",
  isSelectable,
}: SectionSelectProps) {
  const { topLevel, childrenByParent, byId } = useMemo(
    () => buildSectionTree(sections),
    [sections]
  );
  const selected = value ? byId.get(value) : null;
  const selectedPath = selected ? sectionFullPath(selected, byId) : null;

  // Flatten the tree to display rows so the dropdown renders parents in
  // order with their children indented underneath.
  const treeRows = useMemo(() => {
    const rows: { section: DbProjectDocumentSection; depth: number }[] = [];
    for (const p of topLevel) {
      rows.push({ section: p, depth: 0 });
      for (const c of childrenByParent.get(p.id) ?? []) {
        rows.push({ section: c, depth: 1 });
      }
    }
    return rows;
  }, [topLevel, childrenByParent]);

  const fullPath = (s: DbProjectDocumentSection) => sectionFullPath(s, byId);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-text-secondary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <SearchableDropdown
        minContentWidth={280}
        maxListHeight={280}
        isEmpty={false}
        align="start"
        headerSlot={
          onCreateNew
            ? (close) => (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onCreateNew();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-accent-strong hover:bg-accent/10 border-b border-border-default transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  New section
                </button>
              )
            : undefined
        }
        trigger={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary cursor-pointer",
              "focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {selected && selectedPath ? (
                <>
                  <SectionIcon
                    icon={selected.icon}
                    className="w-3.5 h-3.5 text-text-secondary shrink-0"
                  />
                  <span className="truncate">{selectedPath}</span>
                </>
              ) : (
                <span className="italic text-text-muted">{placeholder}</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
          </button>
        }
      >
        {(query, close) => {
          if (query) {
            // Searching collapses the tree into a flat filtered list where
            // each match shows its full "Parent / Child" path so the user can
            // disambiguate same-named leaves across parents.
            const filtered = sections.filter((s) =>
              fullPath(s).toLowerCase().includes(query)
            );
            if (filtered.length === 0) {
              return (
                <p className="px-3 py-4 text-sm text-text-muted text-center">
                  No sections match.
                </p>
              );
            }
            return filtered.map((s) => (
              <PickerItem
                key={s.id}
                section={s}
                label={fullPath(s)}
                depth={0}
                isSelected={value === s.id}
                selectable={!isSelectable || isSelectable(s)}
                onPick={() => {
                  onChange(s.id);
                  close();
                }}
              />
            ));
          }
          if (treeRows.length === 0) {
            return (
              <p className="px-3 py-4 text-sm text-text-muted text-center">
                No sections yet.
              </p>
            );
          }
          return treeRows.map(({ section, depth }) => (
            <PickerItem
              key={section.id}
              section={section}
              label={section.name}
              depth={depth}
              isSelected={value === section.id}
              selectable={!isSelectable || isSelectable(section)}
              onPick={() => {
                onChange(section.id);
                close();
              }}
            />
          ));
        }}
      </SearchableDropdown>
    </div>
  );
}

function PickerItem({
  section,
  label,
  depth,
  isSelected,
  selectable,
  onPick,
}: {
  section: DbProjectDocumentSection;
  label: string;
  depth: number;
  isSelected: boolean;
  selectable: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={selectable ? onPick : undefined}
      disabled={!selectable}
      style={{ paddingLeft: 12 + depth * 16 }}
      className={cn(
        "flex items-center gap-2 w-full pr-3 py-2 text-sm text-left hover:bg-bg-elevated transition-colors cursor-pointer",
        isSelected && "text-accent-strong",
        !selectable && "opacity-40 cursor-not-allowed"
      )}
    >
      <span className="w-4 shrink-0">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      <SectionIcon
        icon={section.icon}
        className="w-3.5 h-3.5 text-text-secondary shrink-0"
      />
      <span className="truncate">{label}</span>
    </button>
  );
}
