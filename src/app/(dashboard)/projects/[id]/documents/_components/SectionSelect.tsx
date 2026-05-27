"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { cn } from "@/lib/utils";
import type { DbProjectDocumentSection } from "@/types";
import { SectionIcon } from "./SectionIcon";

interface SectionSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  sections: DbProjectDocumentSection[];
  label?: string;
  /** When true, render a red asterisk next to the label. */
  required?: boolean;
  /** Opens the parent's NewSectionDialog. Caller wires onSubmit to push the new id into `value`. */
  onCreateNew: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Picker for assigning a document to one of the project's sections, with an
 * inline "+ New section" affordance that opens the parent's NewSectionDialog
 * (the parent already owns the create flow so we don't fork it here).
 *
 * Modelled on `CategorySelect` in /elements — see comment there for the
 * SearchableDropdown header-slot pattern.
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
}: SectionSelectProps) {
  const selected = value ? sections.find((s) => s.id === value) : null;

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
        maxListHeight={240}
        isEmpty={false}
        align="start"
        headerSlot={(close) => (
          <button
            type="button"
            onClick={() => {
              close();
              onCreateNew();
            }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-accent hover:bg-accent/10 border-b border-border-default transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New section
          </button>
        )}
        trigger={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary cursor-pointer",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {selected ? (
                <>
                  <SectionIcon
                    icon={selected.icon}
                    className="w-3.5 h-3.5 text-text-secondary shrink-0"
                  />
                  <span className="truncate">{selected.name}</span>
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
          const filtered = query
            ? sections.filter((s) => s.name.toLowerCase().includes(query))
            : sections;
          if (filtered.length === 0) {
            return (
              <p className="px-3 py-4 text-sm text-text-muted text-center">
                {query ? "No sections match." : "No sections yet."}
              </p>
            );
          }
          return filtered.map((s) => {
            const isSelected = value === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id);
                  close();
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated cursor-pointer",
                  isSelected && "text-accent"
                )}
              >
                <span className="w-4 shrink-0">
                  {isSelected && <Check className="h-4 w-4" />}
                </span>
                <SectionIcon
                  icon={s.icon}
                  className="w-3.5 h-3.5 text-text-secondary shrink-0"
                />
                <span className="truncate">{s.name}</span>
              </button>
            );
          });
        }}
      </SearchableDropdown>
    </div>
  );
}
