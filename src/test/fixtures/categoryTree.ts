import type { ElementCategoryNode } from "@/types";

/** Build an `ElementCategoryNode` for tests. Only the fields any test reads are meaningful. */
export function categoryNode(
  id: string,
  name: string,
  level: 1 | 2 | 3,
  children: ElementCategoryNode[] = []
): ElementCategoryNode {
  return {
    id,
    name,
    level,
    parent_id: null,
    code_prefix: null,
    sort_order: 0,
    icon: null,
    color: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    children,
  } as ElementCategoryNode;
}

/**
 * The shared 3-level fixture.
 *
 * "Base Units" sits under two different parents — the case a flat list of leaf
 * names cannot disambiguate, and the reason a picker searches on the whole path.
 * "Countertops" is deliberately childless: a branch is allowed to be a dead end,
 * and the UI has to say so rather than showing an empty box.
 */
export const CATEGORY_TREE: ElementCategoryNode[] = [
  categoryNode("kit", "Kitchen", 1, [
    categoryNode("cab", "Cabinets", 2, [
      categoryNode("base", "Base Units", 3),
      categoryNode("wall", "Wall Units", 3),
    ]),
    categoryNode("ctp", "Countertops", 2),
  ]),
  categoryNode("joi", "Joinery", 1, [
    categoryNode("fur", "Furniture", 2, [
      categoryNode("jbase", "Base Units", 3),
    ]),
  ]),
];
