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
  UpdateItemPayload,
} from "@/lib/api/boq";
import type { BoqItemWithComputed, BoqSection, BoqWithDetails } from "@/types";

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
        handleError(err, "Could not add item");
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
    async (section: BoqSection) => {
      try {
        await globalMutate(
          key,
          (current: BoqWithDetails | null | undefined) => {
            if (!current) return current;
            return {
              ...current,
              sections: current.sections.filter((s) => s.id !== section.id),
            };
          },
          { revalidate: false }
        );
        await boqApi.deleteSection(projectId, section.id);
        await globalMutate(key);
      } catch (err) {
        await globalMutate(key);
        handleError(err, "Could not delete section");
        throw err;
      }
    },
    [projectId, key]
  );

  return {
    createBoq,
    updateItem,
    deleteItem,
    createItem,
    createSection,
    updateSection,
    deleteSection,
  };
}
