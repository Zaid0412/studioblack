"use client";

import { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoqSection } from "@/types";
import type { BoqItemPhase } from "@/lib/validations";
import { BoqMoveTargetPopover } from "./BoqMoveTargetPopover";
import { BoqPhasePickerPopover } from "./BoqPhasePickerPopover";

interface BoqBulkActionBarProps {
  count: number;
  sections: BoqSection[];
  projectId: string;
  boqId: string;
  /** `sections.length` — seeds sort_order if the user creates a section inline. */
  nextSortOrder: number;
  /** When every selected item shares a section, forwarded to the move popover. */
  sharedSectionId?: string | null;
  /** When every selected item shares a phase, forwarded to the phase picker so it can disable that row. */
  sharedPhase?: BoqItemPhase;
  onMove: (targetSectionId: string | null) => void;
  onSetPhase: (phase: BoqItemPhase, comment?: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Sticky action bar shown when at least one BOQ item is selected.
 *
 * Position: pinned to the bottom of the viewport so it never disappears
 * behind a long table. Esc cancels selection — wired here so the parent
 * doesn't need its own keydown listener.
 */
export function BoqBulkActionBar({
  count,
  sections,
  projectId,
  boqId,
  nextSortOrder,
  sharedSectionId,
  sharedPhase,
  onMove,
  onSetPhase,
  onDelete,
  onCancel,
}: BoqBulkActionBarProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-accent/40 bg-bg-elevated px-4 py-3 shadow-2xl shadow-black/40 ring-1 ring-accent/30 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <span className="text-sm font-semibold text-text-primary px-1">
        {count} item{count === 1 ? "" : "s"} selected
      </span>

      <span className="h-5 w-px bg-border-default" aria-hidden />

      <BoqMoveTargetPopover
        trigger={
          <Button type="button" variant="secondary" size="sm">
            Move to section…
          </Button>
        }
        sections={sections}
        onPick={onMove}
        currentSectionId={sharedSectionId}
        projectId={projectId}
        boqId={boqId}
        nextSortOrder={nextSortOrder}
      />

      <BoqPhasePickerPopover
        trigger={
          <Button type="button" variant="secondary" size="sm">
            Set lifecycle…
          </Button>
        }
        onPick={onSetPhase}
        currentPhase={sharedPhase}
      />

      <Button type="button" variant="danger" size="sm" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>

      <span className="h-5 w-px bg-border-default" aria-hidden />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        aria-label="Cancel selection"
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </Button>
    </div>
  );
}
