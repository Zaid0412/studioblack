"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BOQ_ITEM_PHASES, type BoqItemPhase } from "@/lib/validations";
import { isDestructivePhase, phaseToLabel } from "../_lib/formatters";
import { BoqChangeRequestDialog } from "./BoqChangeRequestDialog";

interface BoqPhasePickerPopoverProps {
  /** Trigger element — usually a Button. Rendered with `asChild`. */
  trigger: React.ReactNode;
  /**
   * Called with the chosen phase + optional comment. A destructive phase
   * (`change_requested`) opens the comment dialog before firing; other
   * phases pass `undefined`.
   */
  onPick: (phase: BoqItemPhase, comment?: string) => void;
}

/**
 * Phase-picker popover used by the BOQ bulk action bar's "Set lifecycle…"
 * button. Lists every phase. Picking a destructive phase opens
 * `BoqChangeRequestDialog` to capture the required comment.
 */
export function BoqPhasePickerPopover({
  trigger,
  onPick,
}: BoqPhasePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  const handlePick = (phase: BoqItemPhase) => {
    setOpen(false);
    if (isDestructivePhase(phase)) {
      setCommentOpen(true);
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
            {BOQ_ITEM_PHASES.map((phase) => (
              <li key={phase}>
                <button
                  type="button"
                  onClick={() => handlePick(phase)}
                  className={cn(
                    "flex items-center w-full text-left px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-elevated cursor-pointer",
                    isDestructivePhase(phase) && "text-error"
                  )}
                >
                  <span className="flex-1 truncate">{phaseToLabel(phase)}</span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <BoqChangeRequestDialog
        open={commentOpen}
        onOpenChange={setCommentOpen}
        onSubmit={(comment) => onPick("change_requested", comment)}
      />
    </>
  );
}
