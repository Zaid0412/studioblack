"use client";

import { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";

export type SectionSelectionState = "none" | "some" | "all";

interface UseBoqSelectionOptions {
  /** Every selectable item id, in display order. Required for "select all" toggling. */
  allItemIds: string[];
  /** Per-section id → item ids belonging to that section. `null` key is the Unassigned bucket. */
  itemIdsBySection: Map<string | null, string[]>;
}

/**
 * Stateful helper for the BOQ table's multi-select / bulk-action mode.
 *
 * `selected` is a `Set<string>` of item ids. Selection persists across
 * filter changes; downstream consumers can intersect with the filter
 * result themselves if they want to dim out hidden-but-selected rows.
 *
 * `sectionState(id)` derives the section header's checkbox state from
 * the current selection. Useful for the tri-state header indicator.
 *
 * The hook is unopinionated about visibility — it doesn't know about
 * `sourceFilter`. Callers decide whether to clamp `allItemIds` to the
 * visible set before passing it in (which matches the Gmail / Linear
 * "select all visible" convention).
 */
export function useBoqSelection({
  allItemIds,
  itemIdsBySection,
}: UseBoqSelectionOptions) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggleMode = useCallback(() => {
    const apply = () => {
      setSelectionMode((on) => {
        if (on) setSelected(new Set()); // exiting mode clears selection
        return !on;
      });
    };

    // Wrap the toggle in a View Transition so the grid-template-columns
    // change crossfades instead of snapping. Falls back to a plain update
    // on browsers without the API.
    const doc =
      typeof document !== "undefined"
        ? (document as Document & {
            startViewTransition?: (cb: () => void) => unknown;
          })
        : null;
    if (doc && typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => flushSync(apply));
    } else {
      apply();
    }
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback((ids: readonly string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        for (const id of ids) next.add(id);
      } else {
        for (const id of ids) next.delete(id);
      }
      return next;
    });
  }, []);

  /** Toggle every visible item. `on` flips based on the current header state when omitted. */
  const toggleAll = useCallback(
    (on?: boolean) => {
      const next = on ?? !allItemIds.every((id) => selected.has(id));
      setAll(allItemIds, next);
    },
    [allItemIds, selected, setAll]
  );

  const tableState: SectionSelectionState = useMemo(() => {
    if (allItemIds.length === 0 || selected.size === 0) return "none";
    let hit = 0;
    for (const id of allItemIds) if (selected.has(id)) hit++;
    if (hit === 0) return "none";
    if (hit === allItemIds.length) return "all";
    return "some";
  }, [allItemIds, selected]);

  const sectionState = useCallback(
    (sectionId: string | null): SectionSelectionState => {
      const ids = itemIdsBySection.get(sectionId);
      if (!ids || ids.length === 0) return "none";
      let hit = 0;
      for (const id of ids) if (selected.has(id)) hit++;
      if (hit === 0) return "none";
      if (hit === ids.length) return "all";
      return "some";
    },
    [itemIdsBySection, selected]
  );

  const toggleSection = useCallback(
    (sectionId: string | null) => {
      const ids = itemIdsBySection.get(sectionId);
      if (!ids || ids.length === 0) return;
      const allSelected = ids.every((id) => selected.has(id));
      setAll(ids, !allSelected);
    },
    [itemIdsBySection, selected, setAll]
  );

  return {
    selectionMode,
    toggleMode,
    selected,
    toggle,
    toggleAll,
    toggleSection,
    clear,
    tableState,
    sectionState,
  };
}
