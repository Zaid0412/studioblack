import type { ElementCategoryNode } from "@/types";

/** Flatten a category tree into an id → name map for quick display lookup. */
export function buildCategoryMap(
  tree: ElementCategoryNode[]
): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: ElementCategoryNode[]) => {
    for (const n of nodes) {
      map.set(n.id, n.name);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(tree);
  return map;
}
