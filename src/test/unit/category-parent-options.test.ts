import { describe, it, expect } from "vitest";
import {
  flattenCategories,
  isServiceArea,
  parentCategoryOptions,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";
import type { ElementCategoryNode } from "@/types";

const node = (
  id: string,
  name: string,
  level: 1 | 2 | 3,
  children: ElementCategoryNode[] = []
): ElementCategoryNode =>
  ({
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
  }) as ElementCategoryNode;

// Kitchen › Cabinets › Base Units, plus a second root with no children.
const TREE: ElementCategoryNode[] = [
  node("kit", "Kitchen", 1, [
    node("cab", "Cabinets", 2, [node("base", "Base Units", 3)]),
  ]),
  node("bth", "Bathroom", 1),
];

/**
 * The parents the generic "New Category" form may offer. Anything deeper would
 * let the user create a Service Area without realising which level they'd made
 * (a Sub-category parent), or pick a parent the server rejects outright (a
 * Service Area parent — level 3 is the floor).
 */
describe("parentCategoryOptions", () => {
  const options = flattenCategories(TREE);

  it("offers top-level Categories only", () => {
    expect(parentCategoryOptions(options).map((o) => o.id)).toEqual([
      "kit",
      "bth",
    ]);
  });

  it("excludes Sub-categories — picking one would create a Service Area", () => {
    expect(parentCategoryOptions(options).map((o) => o.id)).not.toContain(
      "cab"
    );
  });

  it("excludes Service Areas — the server rejects them as a parent", () => {
    const areas = options.filter((o) => isServiceArea(options, o.id));
    expect(areas).toHaveLength(1);
    expect(parentCategoryOptions(options).map((o) => o.id)).not.toContain(
      "base"
    );
  });

  it("is empty when the org has no categories yet", () => {
    expect(parentCategoryOptions(flattenCategories([]))).toEqual([]);
  });
});
