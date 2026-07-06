import type { ElementCategoryNode } from "@/types";
import type { SeedCategory, SeedNode } from "@/lib/categoryTemplates";

export interface CategoryRestoreStatus {
  /** codePrefix → { total default nodes in the subtree, missing (would be created) }. */
  byCode: Map<string, { total: number; missing: number }>;
  /** Missing default nodes summed across every default category. */
  totalMissing: number;
  /** Total default nodes across the whole taxonomy. */
  totalDefault: number;
  /** Top-level org categories that aren't part of the default set (custom). */
  customTopLevel: number;
}

/** Count every node in a seed subtree (the node itself + all descendants). */
function countSeedNodes(nodes: readonly SeedNode[] | undefined): number {
  let c = 0;
  for (const n of nodes ?? []) c += 1 + countSeedNodes(n.children);
  return c;
}

/** Index a level of org nodes by trimmed, lowercased name (bulkCreate's key). */
function childMap(
  nodes: ElementCategoryNode[]
): Map<string, ElementCategoryNode> {
  const m = new Map<string, ElementCategoryNode>();
  for (const n of nodes) m.set(n.name.trim().toLowerCase(), n);
  return m;
}

/**
 * Missing default nodes under a matched org-children list. Mirrors
 * `bulkCreateCategoriesFromTemplates`' dedup rule exactly: a seed node "exists"
 * when a same-named node exists under the same parent (case-insensitive). A
 * seed node with no match counts as missing along with its entire subtree.
 */
function countMissing(
  seedNodes: readonly SeedNode[] | undefined,
  orgChildren: ElementCategoryNode[]
): number {
  const byName = childMap(orgChildren);
  let missing = 0;
  for (const s of seedNodes ?? []) {
    const match = byName.get(s.name.trim().toLowerCase());
    if (!match) missing += 1 + countSeedNodes(s.children);
    else missing += countMissing(s.children, match.children);
  }
  return missing;
}

/**
 * Compare an org's category tree against the master taxonomy to drive the
 * "Restore defaults" dialog: how many default nodes each category is missing
 * (i.e. would be created), the overall total, and whether any custom
 * categories exist. Pure — no I/O.
 */
export function computeRestoreStatus(
  tree: ElementCategoryNode[],
  taxonomy: readonly SeedCategory[]
): CategoryRestoreStatus {
  const byCode = new Map<string, { total: number; missing: number }>();
  let totalMissing = 0;
  let totalDefault = 0;

  for (const cat of taxonomy) {
    const total = 1 + countSeedNodes(cat.children);
    const missing = countMissing([cat], tree);
    byCode.set(cat.codePrefix, { total, missing });
    totalMissing += missing;
    totalDefault += total;
  }

  const defaultNames = new Set(
    taxonomy.map((c) => c.name.trim().toLowerCase())
  );
  const customTopLevel = tree.filter(
    (n) => !defaultNames.has(n.name.trim().toLowerCase())
  ).length;

  return { byCode, totalMissing, totalDefault, customTopLevel };
}
