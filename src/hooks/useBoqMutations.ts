"use client";

import { useCallback } from "react";
import { mutate as globalMutate } from "swr";
import { boq as boqApi, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import type {
  CreateBoqPayload,
  CreateItemPayload,
  CreateSectionPayload,
  UpdateBoqPayload,
  UpdateItemPayload,
} from "@/lib/api/boq";
import type { BoqItemWithComputed, BoqSection, BoqWithDetails } from "@/types";
import type { BoqItemPhase } from "@/lib/validations";

/**
 * BOQ mutation helpers — all share a single SWR cache key so consumers auto-update.
 *
 * Mutations are optimistic where the calculation doesn't need server recompute
 * (delete, section CRUD, lifecycle changes). Item value edits (qty / unit_cost /
 * margin / description) post and wait for the server response to replace the row
 * because sell_price, subtotal, and margin_alert are recomputed server-side.
 */
export function useBoqMutations(projectId: string) {
  const key = API.boq(projectId);

  const handleError = (err: unknown, fallback: string) => {
    const description =
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : fallback;
    toast({ title: fallback, description, variant: "error" });
  };

  const createBoq = useCallback(
    async (data: CreateBoqPayload) => {
      const created = await boqApi.create(projectId, data);
      await globalMutate(key);
      return created;
    },
    [projectId, key]
  );

  const updateBoq = useCallback(
    async (data: Omit<UpdateBoqPayload, "boqId"> & { boqId: string }) => {
      try {
        const updated = await boqApi.update(projectId, data);
        await globalMutate(key);
        return updated;
      } catch (err) {
        handleError(err, "Could not update BOQ");
        throw err;
      }
    },
    [projectId, key]
  );

  const updateItem = useCallback(
    async (itemId: string, data: UpdateItemPayload) => {
      try {
        const updated = await boqApi.updateItem(projectId, itemId, data);
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.map((it) =>
                it.id === itemId ? updated : it
              ),
            };
          },
          { revalidate: true }
        );
        return updated;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast({
            title: "Item was updated elsewhere",
            description: "Refreshing with the latest data.",
            variant: "warning",
          });
          await globalMutate(key);
          return null;
        }
        handleError(err, "Could not update item");
        throw err;
      }
    },
    [projectId, key]
  );

  // RFQ-3d: remove from / restore to scope. Shared by the drawer's Scope action
  // and the delete-blocked prompt so the payload + 409 handling stay in one
  // place. Returns the updated row, or null on a 409 (already toasted).
  const setItemExcluded = useCallback(
    (item: BoqItemWithComputed, excluded: boolean) =>
      updateItem(item.id, {
        updatedAt: item.updated_at,
        isExcluded: excluded,
      }),
    [updateItem]
  );

  const moveItem = useCallback(
    async (item: BoqItemWithComputed, targetSectionId: string | null) => {
      // Same-section move is a no-op — short-circuit so we don't bump
      // updated_at or fire a needless request. Null-safe.
      if ((item.section_id ?? null) === targetSectionId) return item;

      try {
        const updated = await boqApi.moveItem(
          projectId,
          item.id,
          targetSectionId,
          item.updated_at
        );
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.map((it) =>
                it.id === item.id ? updated : it
              ),
            };
          },
          { revalidate: true }
        );
        return updated;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast({
            title: "Item was updated elsewhere",
            description: "Refreshing with the latest data.",
            variant: "warning",
          });
          await globalMutate(key);
          return null;
        }
        handleError(err, "Could not move item");
        throw err;
      }
    },
    [projectId, key]
  );

  const deleteItem = useCallback(
    async (item: BoqItemWithComputed) => {
      try {
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.filter((it) => it.id !== item.id),
            };
          },
          { revalidate: false }
        );
        await boqApi.deleteItem(projectId, item.id, item.updated_at);
        // Revalidate so summary totals reflect the deletion.
        await globalMutate(key);
        toast({ title: "Item deleted", variant: "success" });
      } catch (err) {
        await globalMutate(key); // rollback by refetching
        if (err instanceof ApiError && err.status === 409) {
          toast({
            title: "Item was updated elsewhere",
            description: "Reload before deleting.",
            variant: "warning",
          });
          return;
        }
        handleError(err, "Could not delete item");
        throw err;
      }
    },
    [projectId, key]
  );

  const createItem = useCallback(
    async (data: CreateItemPayload) => {
      try {
        const created = await boqApi.createItem(projectId, data);
        await globalMutate(key);
        return created;
      } catch (err) {
        // A "no room to insert" conflict is handled by the caller (it prompts
        // to renumber and retries), so don't toast a generic error over it.
        if (!boqApi.isNeedsRenumberError(err)) {
          handleError(err, "Could not add item");
        }
        throw err;
      }
    },
    [projectId, key]
  );

  const bulkMoveItems = useCallback(
    async (
      boqId: string,
      itemIds: string[],
      targetSectionId: string | null
    ) => {
      if (itemIds.length === 0) return [];
      try {
        const { items } = await boqApi.bulkMoveItems(
          projectId,
          boqId,
          itemIds,
          targetSectionId
        );
        // Patch each moved item into the cache, then revalidate so
        // per-section sort_order and totals reflect the new state.
        const byId = new Map(items.map((it) => [it.id, it] as const));
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.map((it) => byId.get(it.id) ?? it),
            };
          },
          { revalidate: true }
        );
        return items;
      } catch (err) {
        handleError(err, "Could not move items");
        throw err;
      }
    },
    [projectId, key]
  );

  const bulkDeleteItems = useCallback(
    async (boqId: string, itemIds: string[]) => {
      if (itemIds.length === 0) return 0;
      try {
        const idSet = new Set(itemIds);
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.filter((it) => !idSet.has(it.id)),
            };
          },
          { revalidate: false }
        );
        const { deletedCount, blockedCount } = await boqApi.bulkDeleteItems(
          projectId,
          boqId,
          itemIds
        );
        await globalMutate(key);
        // RFQ-3d: items on an RFQ are skipped server-side (FK restrict) — warn
        // rather than silently under-deleting.
        if (blockedCount > 0) {
          toast({
            title: `${deletedCount} deleted · ${blockedCount} skipped`,
            description:
              "Items that are part of an RFQ can't be deleted — remove them from scope instead.",
            variant: "warning",
          });
        } else {
          toast({
            title:
              deletedCount === 1
                ? "Item deleted"
                : `${deletedCount} items deleted`,
            variant: "success",
          });
        }
        return deletedCount;
      } catch (err) {
        await globalMutate(key); // rollback by refetching
        handleError(err, "Could not delete items");
        throw err;
      }
    },
    [projectId, key]
  );

  const createSection = useCallback(
    async (data: CreateSectionPayload) => {
      try {
        const created = await boqApi.createSection(projectId, data);
        await globalMutate(key);
        return created;
      } catch (err) {
        handleError(err, "Could not add section");
        throw err;
      }
    },
    [projectId, key]
  );

  const updateSection = useCallback(
    async (sectionId: string, data: Partial<CreateSectionPayload>) => {
      try {
        const updated = await boqApi.updateSection(
          projectId,
          sectionId,
          data as Partial<Omit<CreateSectionPayload, "boqId">>
        );
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              sections: current.sections.map((s) =>
                s.id === sectionId ? updated : s
              ),
            };
          },
          { revalidate: false }
        );
        return updated;
      } catch (err) {
        handleError(err, "Could not update section");
        throw err;
      }
    },
    [projectId, key]
  );

  const deleteSection = useCallback(
    async (section: BoqSection, opts?: { cascade?: boolean }) => {
      const cascade = opts?.cascade ?? false;
      try {
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              sections: current.sections.filter((s) => s.id !== section.id),
              // Cascade also wipes the section's items locally. Without it,
              // items keep their data and the server reflows `section_id` to
              // null — we let the revalidate refresh handle that.
              items: cascade
                ? current.items.filter((it) => it.section_id !== section.id)
                : current.items,
            };
          },
          { revalidate: false }
        );
        await boqApi.deleteSection(projectId, section.id, { cascade });
        await globalMutate(key);
      } catch (err) {
        await globalMutate(key);
        handleError(err, "Could not delete section");
        throw err;
      }
    },
    [projectId, key]
  );

  const reorderSections = useCallback(
    async (boqId: string, orderedIds: string[]) => {
      try {
        // Optimistic: re-sort `sections` by orderedIds so the UI updates instantly.
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            const byId = new Map(current.sections.map((s) => [s.id, s]));
            const next = orderedIds
              .map((id) => byId.get(id))
              .filter((s): s is (typeof current.sections)[number] => !!s);
            return { ...current, sections: next };
          },
          { revalidate: false }
        );
        await boqApi.reorderSections(projectId, boqId, orderedIds);
        await globalMutate(key);
      } catch (err) {
        await globalMutate(key);
        handleError(err, "Could not reorder sections");
        throw err;
      }
    },
    [projectId, key]
  );

  const setItemPhase = useCallback(
    async (
      itemId: string,
      phase: BoqItemPhase,
      opts?: { comment?: string }
    ) => {
      try {
        const updated = await boqApi.setItemPhase(projectId, itemId, {
          phase,
          comment: opts?.comment,
        });
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.map((it) =>
                it.id === itemId ? updated : it
              ),
            };
          },
          { revalidate: true }
        );
        return updated;
      } catch (err) {
        handleError(err, "Could not change item phase");
        throw err;
      }
    },
    [projectId, key]
  );

  const bulkSetItemPhase = useCallback(
    async (
      boqId: string,
      itemIds: string[],
      phase: BoqItemPhase,
      opts?: { comment?: string }
    ) => {
      if (itemIds.length === 0) return [];
      try {
        const { items } = await boqApi.bulkSetItemPhase(projectId, {
          boqId,
          itemIds,
          phase,
          comment: opts?.comment,
        });
        const byId = new Map(items.map((it) => [it.id, it] as const));
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              items: current.items.map((it) => byId.get(it.id) ?? it),
            };
          },
          { revalidate: true }
        );
        return items;
      } catch (err) {
        handleError(err, "Could not change item phases");
        throw err;
      }
    },
    [projectId, key]
  );

  return {
    createBoq,
    updateBoq,
    updateItem,
    setItemExcluded,
    moveItem,
    bulkMoveItems,
    bulkDeleteItems,
    deleteItem,
    createItem,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    setItemPhase,
    bulkSetItemPhase,
  };
}
