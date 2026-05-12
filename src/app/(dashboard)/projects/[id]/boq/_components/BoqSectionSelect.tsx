"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { cn } from "@/lib/utils";
import type { BoqSection } from "@/types";
import { BOQ_NO_SECTION_ID } from "../_lib/formatters";
import { BoqCreateSectionDialog } from "./BoqCreateSectionDialog";

interface BoqSectionSelectProps {
  /** Section UUID, or `BOQ_NO_SECTION_ID` for the "(Unassigned)" sentinel. */
  value: string;
  onChange: (next: string) => void;
  sections: BoqSection[];
  label?: string;
  /** When set together with `nextSortOrder`, surfaces "+ New section" in the dropdown header. */
  projectId?: string;
  boqId?: string;
  nextSortOrder?: number;
}

/**
 * Section picker for BOQ item dialogs. Searchable, includes the
 * "(Unassigned)" bucket, and — when `boqId` + `nextSortOrder` are passed —
 * an inline "+ New section" affordance that opens `BoqCreateSectionDialog`
 * and auto-selects the new section on create.
 */
export function BoqSectionSelect({
  value,
  onChange,
  sections,
  label = "Section",
  projectId,
  boqId,
  nextSortOrder,
}: BoqSectionSelectProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!projectId && !!boqId && typeof nextSortOrder === "number";

  const selectedLabel =
    value === BOQ_NO_SECTION_ID
      ? "(Unassigned)"
      : (sections.find((s) => s.id === value)?.title ?? "(Unassigned)");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      )}
      <SearchableDropdown
        minContentWidth={280}
        maxListHeight={240}
        isEmpty={false}
        headerSlot={
          canCreate
            ? (close) => (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setCreateOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent hover:bg-accent/10 border-b border-border-default transition-colors w-full text-left"
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
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            )}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
          </button>
        }
      >
        {(query, close) => {
          const filtered = query
            ? sections.filter((s) => s.title.toLowerCase().includes(query))
            : sections;
          // `"(unassigned)".includes(...)` is a superset of `"unassigned".includes(...)`,
          // so the parenthesised form covers both spellings the user might type.
          const showUnassigned = !query || "(unassigned)".includes(query);
          return (
            <>
              {showUnassigned && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(BOQ_NO_SECTION_ID);
                    close();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                    value === BOQ_NO_SECTION_ID && "text-accent"
                  )}
                >
                  <span className="w-4 shrink-0">
                    {value === BOQ_NO_SECTION_ID && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  <span className="italic text-text-muted">(Unassigned)</span>
                </button>
              )}
              {filtered.length === 0 && !showUnassigned ? (
                <p className="px-3 py-4 text-sm text-text-muted text-center">
                  No matches
                </p>
              ) : (
                filtered.map((s) => {
                  const selected = value === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onChange(s.id);
                        close();
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                        selected && "text-accent"
                      )}
                    >
                      <span className="w-4 shrink-0">
                        {selected && <Check className="h-4 w-4" />}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  );
                })
              )}
            </>
          );
        }}
      </SearchableDropdown>

      {canCreate && (
        <BoqCreateSectionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId!}
          boqId={boqId!}
          nextSortOrder={nextSortOrder!}
          onCreated={(created) => onChange(created.id)}
        />
      )}
    </div>
  );
}
