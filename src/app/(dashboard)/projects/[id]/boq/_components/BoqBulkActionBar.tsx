"use client";

import { useEffect } from "react";
import { Loader2, Trash2, X } from "lucide-react";
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
  /** Phases the viewer is permitted to fire, pre-filtered through the role matrix. */
  allowedPhases: readonly BoqItemPhase[];
  /** Gates the move + delete buttons. Clients bulk-approve / request-changes only. */
  canEdit?: boolean;
  /**
   * Disables every action + shows a spinner while a bulk request is in
   * flight. Parent owns the flag (set true before await, reset in finally).
   */
  pending?: boolean;
  onMove: (targetSectionId: string | null) => void;
  onSetPhase: (phase: BoqItemPhase, comment?: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  /**
   * Forwarded to the phase picker. True when the bulk preview dialog will
   * handle destructive-comment capture — avoids prompting twice.
   */
  skipDestructivePrompt?: boolean;
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
  allowedPhases,
  canEdit = true,
  pending = false,
  onMove,
  onSetPhase,
  onDelete,
  onCancel,
  skipDestructivePrompt = false,
}: BoqBulkActionBarProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Esc-to-cancel is for the idle bar only. Bailing during a pending
      // request would drop the user back to a stale-looking table.
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, pending]);

  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-busy={pending || undefined}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-accent/40 bg-bg-elevated px-4 py-3 shadow-2xl shadow-black/40 ring-1 ring-accent/30 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {pending ? (
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary px-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          Updating {count} item{count === 1 ? "" : "s"}…
        </span>
      ) : (
        <span className="text-sm font-semibold text-text-primary px-1">
          {count} item{count === 1 ? "" : "s"} selected
        </span>
      )}

      <span className="h-5 w-px bg-border-default" aria-hidden />

      {canEdit && (
        <BoqMoveTargetPopover
          trigger={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
            >
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
      )}

      {allowedPhases.length > 0 && (
        <BoqPhasePickerPopover
          trigger={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
            >
              Set lifecycle…
            </Button>
          }
          onPick={onSetPhase}
          currentPhase={sharedPhase}
          allowedPhases={allowedPhases}
          skipDestructivePrompt={skipDestructivePrompt}
        />
      )}

      {canEdit && (
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      )}

      <span className="h-5 w-px bg-border-default" aria-hidden />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={pending}
        aria-label="Cancel selection"
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </Button>
    </div>
  );
}
