import type { ElementCategoryNode } from "@/types";

export interface CategoryOption {
  id: string;
  label: string;
  /** Full path code (`KIT-CAB`) — what a child's code is composed onto. */
  codePrefix: string | null;
  /** 0-indexed tree depth: 0 = Category, 1 = Sub-category, 2 = Service Area. */
  depth: number;
}

/** Tree depth of a Service Area (level-3) node — where elements must sit. */
export const SERVICE_AREA_DEPTH = 2;

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
  const walk = (
    nodes: ElementCategoryNode[],
    path: string[],
    depth: number
  ) => {
    for (const node of nodes) {
      const nextPath = [...path, node.name];
      out.push({
        id: node.id,
        label: nextPath.join(" › "),
        codePrefix: node.code_prefix,
        depth,
      });
      if (node.children.length > 0) walk(node.children, nextPath, depth + 1);
    }
  };
  walk(tree, [], 0);
  return out;
}

/** True when the id names a Service Area — the only thing an element may sit under. */
export function isServiceArea(
  options: CategoryOption[],
  id: string | null
): boolean {
  if (!id) return false;
  return options.find((o) => o.id === id)?.depth === SERVICE_AREA_DEPTH;
}

/**
 * The full path code (`KIT-CAB`) of a category, or null. This is the prefix an
 * element's code is built from — see `@/lib/categoryCode`.
 */
export function categoryPrefixOf(
  options: CategoryOption[],
  id: string | null
): string | null {
  if (!id) return null;
  return options.find((o) => o.id === id)?.codePrefix?.trim() || null;
}
