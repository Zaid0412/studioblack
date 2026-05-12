"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BoqSection } from "@/types";
import { BoqCreateSectionDialog } from "./BoqCreateSectionDialog";

// Sentinel marker: caller didn't pass currentSectionId at all (mixed selection).
const NO_CURRENT_MARKER = Symbol("no-current");
type CurrentSection = string | null | typeof NO_CURRENT_MARKER;

interface BoqMoveTargetPopoverProps {
  /** Trigger element — usually a Button. Rendered with `asChild`. */
  trigger: React.ReactNode;
  sections: BoqSection[];
  /** Called with the chosen target. `null` = Unassigned. */
  onPick: (targetSectionId: string | null) => void;
  /**
   * When every selected item already lives in the same section, pass it
   * here so the popover marks it Current + disabled (mirrors the row's
   * Move sub-menu). Omit for mixed selections — nothing is marked.
   * `null` means the Unassigned bucket is the shared current.
   */
  currentSectionId?: string | null;
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
  currentSectionId,
  projectId,
  boqId,
  nextSortOrder,
}: BoqMoveTargetPopoverProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!projectId && !!boqId && typeof nextSortOrder === "number";

  // `arguments.length`-style trick: distinguish "prop not passed" from
  // "prop passed as undefined". Callers using TypeScript will pass `null`
  // for Unassigned, a UUID for a section, or omit the prop entirely.
  const current: CurrentSection =
    currentSectionId === undefined ? NO_CURRENT_MARKER : currentSectionId;
  const isCurrent = (s: string | null) =>
    current !== NO_CURRENT_MARKER && s === current;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[280px] p-0 max-h-[320px] overflow-y-auto"
        >
          <ul className="py-1">
            <li>
              <Choice
                onClick={() => {
                  if (isCurrent(null)) return;
                  setPopoverOpen(false);
                  onPick(null);
                }}
                italic
                label="(Unassigned)"
                disabled={isCurrent(null)}
                trailing={isCurrent(null) ? <CurrentBadge /> : undefined}
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
                    if (isCurrent(s.id)) return;
                    setPopoverOpen(false);
                    onPick(s.id);
                  }}
                  label={s.title}
                  disabled={isCurrent(s.id)}
                  trailing={isCurrent(s.id) ? <CurrentBadge /> : undefined}
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
  disabled,
  trailing,
}: {
  onClick: () => void;
  label: string;
  italic?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-text-primary transition-colors",
        disabled
          ? "cursor-default opacity-60"
          : "hover:bg-bg-elevated cursor-pointer",
        italic && "italic text-text-muted"
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function CurrentBadge() {
  return (
    <Badge
      variant="info"
      className="ml-2 !px-1.5 !py-0 text-[10px] font-medium"
    >
      Current
    </Badge>
  );
}
