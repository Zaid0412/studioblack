// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

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

const TREE: ElementCategoryNode[] = [
  node("kit", "Kitchen", 1, [
    node("cab", "Cabinets", 2, [
      node("base", "Base Units", 3),
      node("wall", "Wall Units", 3),
    ]),
  ]),
];

// The editor reads the tree through SWR; the picker's own drill is covered by
// ServiceAreaSelect.test.tsx, so here we only need the tree to resolve.
vi.mock("@/hooks/useCategoryTree", async () => {
  const { flattenCategories } =
    await import("@/app/(dashboard)/elements/_lib/categoryUtils");
  return {
    useCategoryTree: () => ({
      tree: TREE,
      options: flattenCategories(TREE),
      isServiceAreaId: () => true,
      loaded: true,
    }),
  };
});

import {
  VendorTradesEditor,
  type TradeDraft,
} from "@/app/(dashboard)/vendors/_components/VendorTradesEditor";

const BASE: TradeDraft = {
  categoryId: "base",
  proficiencyLevel: "standard",
  notes: "",
};

function renderEditor(trades: TradeDraft[] = []) {
  const onChange = vi.fn();
  render(<VendorTradesEditor trades={trades} onChange={onChange} />);
  return onChange;
}

/** Drill the composer's picker down to a leaf and pick it. */
function pick(leaf: string) {
  fireEvent.click(
    screen.getByRole("button", { name: /serviceAreaPlaceholder/ })
  );
  fireEvent.click(screen.getByText("Kitchen"));
  fireEvent.click(screen.getByText("Cabinets"));
  fireEvent.click(screen.getByText(leaf));
}

const addButton = () => screen.getByRole("button", { name: /addTrade/ });

describe("VendorTradesEditor", () => {
  afterEach(cleanup);

  it("starts empty, with nothing to add yet", () => {
    renderEditor();

    expect(screen.getByText("noTrades")).toBeDefined();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("composes an area, commits it on Add, and resets the composer", () => {
    const onChange = renderEditor();

    pick("Base Units");
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(addButton());
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      { categoryId: "base", proficiencyLevel: "standard", notes: "" },
    ]);

    // Composer is empty again — the next area starts from scratch, and Add
    // can't fire twice on the same pick.
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("refuses an area the vendor already covers", () => {
    const onChange = renderEditor([BASE]);

    pick("Base Units");

    expect(screen.getByText("duplicateTrade")).toBeDefined();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(addButton());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lists an assigned area by its full path, not the bare leaf name", () => {
    renderEditor([BASE]);

    // "Base Units" alone doesn't say which Base Units.
    expect(screen.getByText("Kitchen › Cabinets › Base Units")).toBeDefined();
    expect(screen.queryByText("noTrades")).toBeNull();
  });

  it("removes an assigned area", () => {
    const onChange = renderEditor([
      BASE,
      { categoryId: "wall", proficiencyLevel: "specialist", notes: "" },
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "removeTrade" })[0]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      { categoryId: "wall", proficiencyLevel: "specialist", notes: "" },
    ]);
  });
});
