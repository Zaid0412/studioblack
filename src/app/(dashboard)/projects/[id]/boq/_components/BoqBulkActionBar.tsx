"use client";

import { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoqSection } from "@/types";
import { BoqMoveTargetPopover } from "./BoqMoveTargetPopover";

interface BoqBulkActionBarProps {
  count: number;
  sections: BoqSection[];
  projectId: string;
  boqId: string;
  /** `sections.length` — seeds sort_order if the user creates a section inline. */
  nextSortOrder: number;
  onMove: (targetSectionId: string | null) => void;
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
  onMove,
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-border-default bg-bg-secondary px-3 py-2 shadow-2xl"
    >
      <span className="text-sm font-medium text-text-primary px-2">
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
        projectId={projectId}
        boqId={boqId}
        nextSortOrder={nextSortOrder}
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
