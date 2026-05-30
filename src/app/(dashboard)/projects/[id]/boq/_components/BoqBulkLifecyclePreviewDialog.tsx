"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpFromLine, Ban, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type BoqItemPhase } from "@/lib/validations";
import type { BoqItemWithComputed, UserRole } from "@/types";
import {
  isDestructivePhase,
  phaseToLabel,
  phaseToVariant,
} from "../_lib/formatters";
import {
  buildPhaseGroups,
  buildPlanByTarget,
  type BulkLifecyclePlanEntry,
  type PhaseGroup,
} from "../_lib/bulkLifecyclePlanner";
import { TEXTAREA_CLS } from "./BoqChangeRequestDialog";

interface BoqBulkLifecyclePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Primary target the user picked from the bulk picker. */
  target: BoqItemPhase;
  selectedItems: BoqItemWithComputed[];
  role: UserRole | null;
  currentUserId: string | null;
  boqCreatorId: string | null;
  /** Fires the resolved plan. One entry per distinct target. */
  onConfirm: (
    plan: BulkLifecyclePlanEntry[],
    comment?: string
  ) => Promise<void> | void;
}

/**
 * Mixed-phase preview for the bulk lifecycle picker (Pattern A).
 *
 * Groups the selection by current phase. Groups whose phase can reach the
 * user-picked target are "direct" and locked in. Other groups get an inline
 * dropdown listing their own legal transitions so the PM can resolve them
 * without leaving the dialog. Confirm fires one API call per distinct target
 * in the resolved plan.
 */
export function BoqBulkLifecyclePreviewDialog({
  open,
  onOpenChange,
  target,
  selectedItems,
  role,
  currentUserId,
  boqCreatorId,
  onConfirm,
}: BoqBulkLifecyclePreviewDialogProps) {
  const [fallbacks, setFallbacks] = useState<
    Partial<Record<BoqItemPhase, BoqItemPhase>>
  >({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFallbacks({});
      setComment("");
      setSubmitting(false);
    }
  }, [open]);

  const groups = useMemo<PhaseGroup[]>(
    () =>
      buildPhaseGroups(selectedItems, target, {
        role,
        actorId: currentUserId,
        boqCreatorId,
      }),
    [target, selectedItems, role, currentUserId, boqCreatorId]
  );

  // Single pass: derive the per-group fire-target plus the running totals
  // that drive the footer counter, the destructive-comment field, and the
  // disabled state on the confirm button.
  const { resolved, appliedCount, requiresComment } = useMemo(() => {
    const map = new Map<BoqItemPhase, BoqItemPhase | null>();
    let count = 0;
    let destructive = false;
    for (const g of groups) {
      const r = g.primary ? target : (fallbacks[g.phase] ?? null);
      map.set(g.phase, r);
      if (r) {
        count += g.itemIds.length;
        if (isDestructivePhase(r)) destructive = true;
      }
    }
    return { resolved: map, appliedCount: count, requiresComment: destructive };
  }, [groups, target, fallbacks]);

  const canConfirm =
    appliedCount > 0 && (!requiresComment || comment.trim().length > 0);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    const plan = buildPlanByTarget(groups, target, fallbacks);
    setSubmitting(true);
    try {
      await onConfirm(plan, requiresComment ? comment.trim() : undefined);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const itemCount = selectedItems.length;
  const phaseCount = groups.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-warning" />
            Set phase to {phaseToLabel(target)}?
          </DialogTitle>
          <DialogDescription>
            {itemCount} item{itemCount === 1 ? "" : "s"} selected
            {phaseCount > 1 ? ` · ${phaseCount} different phases` : ""}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-text-secondary -mt-1">
          Groups whose phase reaches the target apply directly. For the rest,
          pick a legal move per group or leave them skipped.
        </p>

        <div className="flex flex-col rounded-lg border border-border-default overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 border-b border-border-default bg-bg-elevated/40">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">
              Current phase
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">
              Fallback action
            </span>
          </div>
          {groups.map((group, idx) => {
            const isLast = idx === groups.length - 1;
            return (
              <div
                key={group.phase}
                className={cn(
                  "grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-3",
                  !isLast && "border-b border-border-default"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant={phaseToVariant(group.phase)}
                    className="text-[10px] px-2 py-0.5"
                  >
                    {phaseToLabel(group.phase)}
                  </Badge>
                  <span className="text-sm text-text-secondary truncate">
                    {group.itemIds.length} item
                    {group.itemIds.length === 1 ? "" : "s"}
                  </span>
                </div>
                <GroupAction
                  group={group}
                  resolved={resolved.get(group.phase) ?? null}
                  primaryTarget={target}
                  onChoose={(t) =>
                    setFallbacks((prev) => {
                      const next = { ...prev };
                      if (t === null) delete next[group.phase];
                      else next[group.phase] = t;
                      return next;
                    })
                  }
                />
              </div>
            );
          })}
        </div>

        {requiresComment && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Reason <span className="text-error">*</span>
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              autoFocus
              placeholder="What needs to change before this can be re-approved?"
              className={TEXTAREA_CLS}
            />
            <span className="text-[11px] text-text-muted">
              Shared across every group set to a destructive phase.
            </span>
          </label>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border-default">
          <span className="text-sm text-text-secondary">
            {appliedCount} of {itemCount} items will be updated
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={requiresComment ? "danger" : "primary"}
              size="sm"
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
            >
              {submitting
                ? "Working…"
                : `Apply (${appliedCount} item${appliedCount === 1 ? "" : "s"})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Right-hand column: either the locked-in primary target or a fallback picker. */
function GroupAction({
  group,
  resolved,
  primaryTarget,
  onChoose,
}: {
  group: PhaseGroup;
  resolved: BoqItemPhase | null;
  primaryTarget: BoqItemPhase;
  /** Null clears the fallback (explicit Skip). */
  onChoose: (target: BoqItemPhase | null) => void;
}) {
  if (group.primary) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success whitespace-nowrap">
        <Check className="h-3 w-3" />
        {phaseToLabel(primaryTarget)}
      </span>
    );
  }
  if (group.legalTargets.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap">
        <Ban className="h-3 w-3" />
        No action available
      </span>
    );
  }
  // "__skip__" is a sentinel — Select can't bind to null/empty-string, so we
  // map the explicit Skip choice through this constant and translate back in
  // the change handler.
  const SKIP = "__skip__";
  return (
    <Select
      value={resolved ?? SKIP}
      onValueChange={(v) => onChoose(v === SKIP ? null : (v as BoqItemPhase))}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder="Choose action…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SKIP} className="text-text-muted">
          Skip — leave unchanged
        </SelectItem>
        {group.legalTargets.map((t) => (
          <SelectItem
            key={t}
            value={t}
            className={cn(isDestructivePhase(t) && "text-error")}
          >
            {phaseToLabel(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
