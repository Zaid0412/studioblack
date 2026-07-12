import type { ElementCategoryNode } from "@/types";

export interface CategoryOption {
  id: string;
  label: string;
  /** Full path code (`KIT-CAB`) — what a child's code is composed onto. */
  codePrefix: string | null;
}

/**
 * Flatten the nested category tree into a depth-first list of selectable
 * options. The label renders the full path using " › " as separator, so that
 * users can disambiguate categories with duplicate names under different
 * parents (e.g. "Walls › Interior › Painted").
 */
export function flattenCategories(
  tree: ElementCategoryNode[]
): CategoryOption[] {
  const out: CategoryOption[] = [];
  const walk = (nodes: ElementCategoryNode[], path: string[]) => {
    for (const node of nodes) {
      const nextPath = [...path, node.name];
      out.push({
        id: node.id,
        label: nextPath.join(" › "),
        codePrefix: node.code_prefix,
      });
      if (node.children.length > 0) walk(node.children, nextPath);
    }
  };
  walk(tree, []);
  return out;
}

/** Depth-first lookup of a node anywhere in the tree. */
export function findCategoryNode(
  tree: ElementCategoryNode[],
  id: string | null
): ElementCategoryNode | null {
  if (!id) return null;
  for (const node of tree) {
    if (node.id === id) return node;
    const hit = findCategoryNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}
