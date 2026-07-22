import type { ElementCategoryNode } from "@/types";

export type CategoryLevel = 1 | 2 | 3;
export type UsageFilter = "in-use" | "unused";
export type SortField = "name" | "code" | "elements" | "updated";
export type SortDir = "asc" | "desc";

export interface CategoryFilters {
  search: string;
  level: CategoryLevel | null;
  usage: UsageFilter | null;
}

export const EMPTY_FILTERS: CategoryFilters = {
  search: "",
  level: null,
  usage: null,
};

/** True when any of search / level / usage is set. */
export function hasActiveFilters(f: CategoryFilters): boolean {
  return f.search.trim() !== "" || f.level !== null || f.usage !== null;
}

/** Whether a node matches every active predicate — its own attributes only. */
function nodeMatches(node: ElementCategoryNode, f: CategoryFilters): boolean {
  if (f.level !== null && node.level !== f.level) return false;
  if (f.usage === "in-use" && node.in_use !== true) return false;
  if (f.usage === "unused" && node.in_use === true) return false;
  const q = f.search.trim().toLowerCase();
  if (q) {
    const name = node.name.toLowerCase();
    const code = (node.code_prefix ?? "").toLowerCase();
    if (!name.includes(q) && !code.includes(q)) return false;
  }
  return true;
}

/**
 * Prune the tree to matching nodes, keeping the ancestors of any match so it
 * stays reachable in the hierarchy. A node is kept when it matches or any
 * descendant is kept. Pure — returns fresh nodes, never mutates the input.
 */
export function pruneCategoryTree(
  tree: ElementCategoryNode[],
  f: CategoryFilters
): ElementCategoryNode[] {
  if (!hasActiveFilters(f)) return tree;
  const walk = (nodes: ElementCategoryNode[]): ElementCategoryNode[] => {
    const out: ElementCategoryNode[] = [];
    for (const node of nodes) {
      const keptChildren = walk(node.children);
      if (nodeMatches(node, f) || keptChildren.length > 0) {
        out.push({ ...node, children: keptChildren });
      }
    }
    return out;
  };
  return walk(tree);
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareNodes(
  a: ElementCategoryNode,
  b: ElementCategoryNode,
  field: SortField
): number {
  switch (field) {
    case "name":
      return collator.compare(a.name, b.name);
    case "code":
      return collator.compare(a.code_prefix ?? "", b.code_prefix ?? "");
    case "elements":
      return (a.element_count ?? 0) - (b.element_count ?? 0);
    case "updated":
      return (
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
  }
}

/**
 * Sort children within every sibling group by `field`, preserving the tree
 * shape (a tree can't be flat-sorted without breaking parent/child). Pure.
 */
export function sortCategoryTree(
  tree: ElementCategoryNode[],
  field: SortField | null,
  dir: SortDir
): ElementCategoryNode[] {
  if (!field) return tree;
  const sign = dir === "asc" ? 1 : -1;
  const walk = (nodes: ElementCategoryNode[]): ElementCategoryNode[] =>
    [...nodes]
      .sort((a, b) => sign * compareNodes(a, b, field))
      .map((n) => ({ ...n, children: walk(n.children) }));
  return walk(tree);
}
