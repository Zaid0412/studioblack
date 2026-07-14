import { SERVICE_AREA_LEVEL } from "@/lib/categoryCode";
import type { ElementCategoryNode } from "@/types";

export interface CategoryOption {
  id: string;
  /** The node's own name — what a picker row shows once the path is implied. */
  name: string;
  label: string;
  /** The names above it, own name last: `["Kitchen", "Cabinets", "Base"]`. */
  path: string[];
  /** Full path code (`KIT-CAB`) — what a child's code is composed onto. */
  codePrefix: string | null;
  /** 0-indexed tree depth: 0 = Category, 1 = Sub-category, 2 = Service Area. */
  depth: number;
  icon: string | null;
  color: string | null;
}

/**
 * What sits between the names of a category path. Shared because a picker
 * renders the path split into pieces to control what clips first, while the
 * accessible name renders it whole — and the two have to agree.
 */
export const CATEGORY_PATH_SEPARATOR = " › ";

/** `["Kitchen", "Cabinets"]` → `"Kitchen › Cabinets"`. */
export function joinCategoryPath(path: string[]): string {
  return path.join(CATEGORY_PATH_SEPARATOR);
}

/**
 * Tree depth of a Service Area — where elements must sit.
 *
 * `level` (from the DB) is the real invariant; `depth` is a rendering concern
 * that happens to be one less. Derive it rather than hard-coding a second
 * number that could drift from the first.
 */
export const SERVICE_AREA_DEPTH = SERVICE_AREA_LEVEL - 1;

/** Tree depth of a top-level Category — the root of every path. */
export const CATEGORY_DEPTH = 0;

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
        name: node.name,
        label: joinCategoryPath(nextPath),
        path: nextPath,
        codePrefix: node.code_prefix,
        depth,
        icon: node.icon,
        color: node.color,
      });
      if (node.children.length > 0) walk(node.children, nextPath, depth + 1);
    }
  };
  walk(tree, [], 0);
  return out;
}

/**
 * Where a node sits in the tree, expressed as the drill-down cursor that shows
 * it: the Category you must be inside, and the Sub-category under that (null at
 * the top). Note this resolves *to the node's own list*, not to its parent —
 * a Category resolves to itself, so a picker seeded with it lands on its
 * Sub-categories; a Service Area resolves to its Sub-category, so a picker
 * seeded with it lands on its siblings with itself among them.
 */
export interface CategoryLocation {
  category: ElementCategoryNode;
  sub: ElementCategoryNode | null;
  depth: number;
}

/**
 * Index every node by id → the cursor that reveals it. This is what lets a
 * picker open *where the current value lives* rather than back at the root,
 * at any depth — including a grandfathered value that names a Category or
 * Sub-category instead of a Service Area, where landing on that node's children
 * is exactly the list the user has to choose from to fix the record.
 *
 * An id that isn't in the tree is absent from the map; callers fall back to the
 * root, which is also what happens while the tree is still loading.
 */
export function buildCategoryIndex(
  tree: ElementCategoryNode[]
): Map<string, CategoryLocation> {
  const index = new Map<string, CategoryLocation>();
  for (const category of tree) {
    index.set(category.id, { category, sub: null, depth: 0 });
    for (const sub of category.children) {
      index.set(sub.id, { category, sub, depth: 1 });
      for (const area of sub.children) {
        index.set(area.id, { category, sub, depth: 2 });
      }
    }
  }
  return index;
}

/**
 * The parents the generic "New Category" form may offer: top-level Categories
 * only. Picking none creates a Category; picking one creates a Sub-category.
 *
 * A Service Area is deliberately not reachable from that form — it is created
 * from the `+` on a Sub-category row in the tree, or built as a whole chain by
 * `ServiceAreaDialog`. Offering a Sub-category here would let someone create a
 * Service Area without realising which level they'd made, and offering a
 * Service Area would offer a parent the server rejects outright (level 3 is the
 * floor — see the `level < 3` guard in `createCategory`).
 */
export function parentCategoryOptions(
  options: CategoryOption[]
): CategoryOption[] {
  return options.filter((o) => o.depth === CATEGORY_DEPTH);
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
