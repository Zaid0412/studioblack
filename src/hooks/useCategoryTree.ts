"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { API } from "@/lib/api/routes";
import {
  flattenCategories,
  isServiceArea,
  type CategoryOption,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";
import type { ElementCategoryNode } from "@/types";

/**
 * The org's element-category tree, plus the flattened option list every picker
 * needs. Three dialogs were each writing the same SWR call, the same `?? []`
 * fallback (which mints a fresh array identity every render and quietly defeats
 * the memo below it), and the same flatten.
 *
 * `loaded` matters: until the tree arrives, nothing resolves to a Service Area,
 * so a caller that gates on `isServiceAreaId` alone would flash "required" at a
 * record that already has one.
 *
 * Pass `enabled: false` to hold the fetch while a dialog is closed. The SWR key
 * is shared, so the second and third consumer on a page are cache hits.
 */
export function useCategoryTree(enabled = true) {
  const { data } = useSWR<{ tree: ElementCategoryNode[] }>(
    enabled ? API.elementCategories() : null
  );

  const tree = useMemo(() => data?.tree ?? [], [data?.tree]);
  const options: CategoryOption[] = useMemo(
    () => flattenCategories(tree),
    [tree]
  );

  // A type guard, so a host that gates its submit on this also gets the
  // non-null narrowing it needs to send the id.
  const isServiceAreaId = useCallback(
    (id: string | null): id is string => isServiceArea(options, id),
    [options]
  );

  return { tree, options, isServiceAreaId, loaded: data !== undefined };
}
