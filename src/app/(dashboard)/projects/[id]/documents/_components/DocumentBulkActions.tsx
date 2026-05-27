"use client";

import { FolderInput, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DbProjectDocumentSection } from "@/types";
import { SectionIcon } from "./SectionIcon";

interface DocumentBulkActionsProps {
  /** Sections available as Move targets — caller filters out the active section. */
  sections: DbProjectDocumentSection[];
  onMove: (sectionId: string) => void;
  onDelete: () => void;
}

/**
 * Bulk actions for the Documents page selection — Move-to-section (with a
 * popover destination picker) + Delete. Modelled on the design-files
 * `BulkActions` so the two file lists share their selection vocabulary.
 */
export function DocumentBulkActions({
  sections,
  onMove,
  onDelete,
}: DocumentBulkActionsProps) {
  const noTargets = sections.length === 0;
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={noTargets}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-text-secondary bg-bg-elevated/30 border border-border-default hover:bg-bg-elevated/50 transition-colors cursor-pointer",
              noTargets && "opacity-50 cursor-not-allowed"
            )}
          >
            <FolderInput className="w-3.5 h-3.5" />
            Move to section
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <div className="flex flex-col">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onMove(s.id)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated rounded-md text-left cursor-pointer"
              >
                <SectionIcon
                  icon={s.icon}
                  className="w-3.5 h-3.5 text-text-secondary"
                />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}
