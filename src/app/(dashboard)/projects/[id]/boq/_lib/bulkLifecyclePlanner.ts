import { type BoqItemPhase } from "@/lib/validations";
import type { BoqItemWithComputed } from "@/types";
import {
  getLegalPhaseTransitions,
  type BoqPhaseTransitionCtx,
} from "./formatters";

/** One bucket of selected items sharing a current phase. */
export interface PhaseGroup {
  phase: BoqItemPhase;
  itemIds: string[];
  /** Legal transitions for this phase, intersected with role permissions. */
  legalTargets: BoqItemPhase[];
  /** True when the user-picked primary target is reachable from this phase. */
  primary: boolean;
}

export interface BulkLifecyclePlanEntry {
  target: BoqItemPhase;
  itemIds: string[];
}

/**
 * Group selected items by current phase and annotate each group with the
 * legal transitions the actor can fire from it. `primary === true` means the
 * group's current phase can transition to the user-picked target directly;
 * other groups need a fallback (or remain skipped).
 */
export function buildPhaseGroups(
  selectedItems: ReadonlyArray<Pick<BoqItemWithComputed, "id" | "phase">>,
  target: BoqItemPhase,
  ctx: BoqPhaseTransitionCtx
): PhaseGroup[] {
  const byPhase = new Map<BoqItemPhase, string[]>();
  for (const it of selectedItems) {
    const ids = byPhase.get(it.phase) ?? [];
    ids.push(it.id);
    byPhase.set(it.phase, ids);
  }
  return Array.from(byPhase.entries()).map(([phase, itemIds]) => {
    const legalTargets = getLegalPhaseTransitions(phase, ctx);
    return {
      phase,
      itemIds,
      legalTargets,
      primary: legalTargets.includes(target),
    };
  });
}

/**
 * Collapse `groups` + per-group fallback choices into one entry per distinct
 * target. Groups with no resolved target are dropped. Each entry can be sent
 * as a single bulk-lifecycle call.
 */
export function buildPlanByTarget(
  groups: ReadonlyArray<PhaseGroup>,
  primaryTarget: BoqItemPhase,
  fallbacks: Readonly<Partial<Record<BoqItemPhase, BoqItemPhase>>>
): BulkLifecyclePlanEntry[] {
  const byTarget = new Map<BoqItemPhase, string[]>();
  for (const g of groups) {
    const resolved = g.primary ? primaryTarget : (fallbacks[g.phase] ?? null);
    if (!resolved) continue;
    const ids = byTarget.get(resolved) ?? [];
    ids.push(...g.itemIds);
    byTarget.set(resolved, ids);
  }
  return Array.from(byTarget.entries()).map(([target, itemIds]) => ({
    target,
    itemIds,
  }));
}
