"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BoqItemPhase } from "@/lib/validations";
import { isDestructivePhase, phaseToLabel } from "../_lib/formatters";
import { BoqChangeRequestDialog } from "./BoqChangeRequestDialog";

interface BoqPhasePickerPopoverProps {
  /** Trigger element — usually a Button. Rendered with `asChild`. */
  trigger: React.ReactNode;
  /**
   * Phases the viewer is permitted to fire. Caller pre-filters through the
   * role-based permission matrix so PM never sees `client_approved`, etc.
   * Order in the array is the order rendered.
   */
  allowedPhases: readonly BoqItemPhase[];
  /**
   * Called with the chosen phase + optional comment. A destructive phase
   * (`*_changes_requested`) opens the comment dialog before firing; other
   * phases pass `undefined`.
   */
  onPick: (phase: BoqItemPhase, comment?: string) => void;
  /**
   * When set, that phase is rendered disabled with a "Current" hint.
   * In bulk context the caller passes the shared phase of every selected
   * item (or `undefined` when the selection is mixed).
   */
  currentPhase?: BoqItemPhase;
  /**
   * Bypass the inline comment dialog for destructive picks. Used by the bulk
   * flow when the selection is mixed — the downstream preview dialog collects
   * the comment instead, so prompting here would double up.
   */
  skipDestructivePrompt?: boolean;
}

/**
 * Phase-picker popover used by the BOQ bulk action bar's "Set lifecycle…"
 * button. Picking a destructive phase opens `BoqChangeRequestDialog` to
 * capture the required comment.
 */
export function BoqPhasePickerPopover({
  trigger,
  allowedPhases,
  onPick,
  currentPhase,
  skipDestructivePrompt = false,
}: BoqPhasePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  // Carry the chosen destructive target so the comment dialog can submit
  // with the right phase — there are two destructive variants now
  // (`internal_changes_requested`, `client_changes_requested`).
  const [pendingDestructive, setPendingDestructive] =
    useState<BoqItemPhase | null>(null);

  const handlePick = (phase: BoqItemPhase) => {
    setOpen(false);
    if (isDestructivePhase(phase) && !skipDestructivePrompt) {
      setPendingDestructive(phase);
      return;
    }
    onPick(phase);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[240px] p-0 max-h-[320px] overflow-y-auto"
        >
          <ul className="py-1">
            {allowedPhases.map((phase) => {
              const isCurrent = phase === currentPhase;
              return (
                <li key={phase}>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handlePick(phase)}
                    className={cn(
                      "flex items-center w-full text-left px-3 py-2 text-sm text-text-primary transition-colors cursor-pointer",
                      isCurrent
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-bg-elevated",
                      isDestructivePhase(phase) && !isCurrent && "text-error"
                    )}
                  >
                    <span className="flex-1 truncate">
                      {phaseToLabel(phase)}
                    </span>
                    {isCurrent && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-text-muted">
                        Current
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      <BoqChangeRequestDialog
        open={pendingDestructive !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDestructive(null);
        }}
        onSubmit={(comment) => {
          if (pendingDestructive) onPick(pendingDestructive, comment);
          setPendingDestructive(null);
        }}
      />
    </>
  );
}
