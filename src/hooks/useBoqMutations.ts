"use client";

import { useCallback } from "react";
import { mutate as globalMutate } from "swr";
import { boq as boqApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type { CreateBoqPayload } from "@/lib/api/boq";

/**
 * BOQ mutation helpers. Each function calls the BOQ API then revalidates the
 * shared `useBoq` cache so consumers update automatically.
 *
 * Task 5A scaffolds only the operations needed for header creation. Task 5C
 * will add item / section mutations (with optimistic splice + 409 handling).
 */
export function useBoqMutations(projectId: string) {
  const key = API.boq(projectId);

  const createBoq = useCallback(
    async (data: CreateBoqPayload) => {
      const created = await boqApi.create(projectId, data);
      // Revalidate so the hook picks up the new BoqWithDetails payload.
      await globalMutate(key);
      return created;
    },
    [projectId, key]
  );

  return { createBoq };
}
