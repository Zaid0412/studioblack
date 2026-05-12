"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BoqSection } from "@/types";
import { BoqCreateSectionDialog } from "./BoqCreateSectionDialog";

interface BoqMoveTargetPopoverProps {
  /** Trigger element — usually a Button. Rendered with `asChild`. */
  trigger: React.ReactNode;
  sections: BoqSection[];
  /** Called with the chosen target. `null` = Unassigned. */
  onPick: (targetSectionId: string | null) => void;
  /** Required for the create-and-move shortcut. Omit to hide the "+" entry. */
  projectId?: string;
  boqId?: string;
  nextSortOrder?: number;
}

/**
 * Section-picker popover used by the BoqBulkActionBar's "Move to section…"
 * button. Lists every section + Unassigned + a "+ Create new section…"
 * entry that opens the create dialog and, on success, fires `onPick(newId)`
 * so the caller can move the selected items into the freshly-created
 * section in the same flow.
 */
export function BoqMoveTargetPopover({
  trigger,
  sections,
  onPick,
  projectId,
  boqId,
  nextSortOrder,
}: BoqMoveTargetPopoverProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!projectId && !!boqId && typeof nextSortOrder === "number";

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[260px] p-0 max-h-[300px] overflow-y-auto"
        >
          <ul className="py-1">
            <li>
              <Choice
                onClick={() => {
                  setPopoverOpen(false);
                  onPick(null);
                }}
                italic
                label="(Unassigned)"
              />
            </li>
            {sections.length > 0 && (
              <li>
                <div className="my-1 border-t border-border-default" />
              </li>
            )}
            {sections.map((s) => (
              <li key={s.id}>
                <Choice
                  onClick={() => {
                    setPopoverOpen(false);
                    onPick(s.id);
                  }}
                  label={s.title}
                />
              </li>
            ))}
            {canCreate && (
              <>
                <li>
                  <div className="my-1 border-t border-border-default" />
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setPopoverOpen(false);
                      setCreateOpen(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-accent hover:bg-accent/10 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create new section…
                  </button>
                </li>
              </>
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {canCreate && (
        <BoqCreateSectionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId!}
          boqId={boqId!}
          nextSortOrder={nextSortOrder!}
          onCreated={(created) => onPick(created.id)}
        />
      )}
    </>
  );
}

function Choice({
  onClick,
  label,
  italic,
}: {
  onClick: () => void;
  label: string;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated transition-colors truncate",
        italic && "italic text-text-muted"
      )}
    >
      {label}
    </button>
  );
}
