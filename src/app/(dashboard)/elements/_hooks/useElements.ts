"use client";

import useSWR from "swr";
import { useCallback, useState } from "react";
import { elements as elementsApi } from "@/lib/api";
import type { ListElementsResponse } from "@/lib/api/elements";
import { toast } from "@/components/ui/useToast";
import type { Element, ElementWithDetails } from "@/types";
import type { ElementFilterState } from "./useElementFilters";

const PAGE_SIZE = 25;

/** Handles listing, create, update, soft-delete, and duplicate for elements. */
export function useElements(filters: ElementFilterState) {
  const params = {
    search: filters.search || undefined,
    categoryId: filters.categoryId ?? undefined,
    unit: filters.unit ?? undefined,
    type: filters.type ?? undefined,
    isActive: filters.isActive,
    sortBy: filters.sortBy ?? undefined,
    sortOrder: filters.sortOrder ?? undefined,
    page: filters.page,
    limit: PAGE_SIZE,
  } as const;

  const key = elementsApi.listKey(params);
  const { data, isLoading, isValidating, mutate } =
    useSWR<ListElementsResponse>(key, { keepPreviousData: true });

  const rows: Element[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [submitting, setSubmitting] = useState(false);

  const create = useCallback(
    async (input: Parameters<typeof elementsApi.create>[0]) => {
      setSubmitting(true);
      try {
        const created = await elementsApi.create(input);
        toast({ title: "Element created" });
        mutate();
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        toast({ title: msg, variant: "error" });
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [mutate]
  );

  const update = useCallback(
    async (id: string, input: Parameters<typeof elementsApi.update>[1]) => {
      setSubmitting(true);
      try {
        const updated = await elementsApi.update(id, input);
        toast({ title: "Element updated" });
        mutate();
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update";
        toast({ title: msg, variant: "error" });
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [mutate]
  );

  const archive = useCallback(
    async (id: string) => {
      try {
        await elementsApi.remove(id);
        toast({ title: "Element archived" });
        mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to archive";
        toast({ title: msg, variant: "error" });
      }
    },
    [mutate]
  );

  const duplicate = useCallback(
    async (id: string): Promise<ElementWithDetails | null> => {
      try {
        const copy = await elementsApi.duplicate(id);
        toast({ title: "Element duplicated" });
        mutate();
        return copy;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to duplicate";
        toast({ title: msg, variant: "error" });
        return null;
      }
    },
    [mutate]
  );

  const restore = useCallback(
    async (id: string) => {
      try {
        await elementsApi.restore(id);
        toast({ title: "Element restored" });
        mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to restore";
        toast({ title: msg, variant: "error" });
      }
    },
    [mutate]
  );

  const promote = useCallback(
    async (id: string) => {
      try {
        await elementsApi.promote(id);
        toast({ title: "Promoted to Company Standard" });
        mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to promote";
        toast({ title: msg, variant: "error" });
      }
    },
    [mutate]
  );

  return {
    rows,
    total,
    totalPages,
    pageSize: PAGE_SIZE,
    isLoading,
    isValidating,
    mutate,
    submitting,
    create,
    update,
    archive,
    duplicate,
    restore,
    promote,
  };
}
