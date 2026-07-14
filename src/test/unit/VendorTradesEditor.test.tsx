// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  fireEvent,
  screen,
  cleanup,
  within,
} from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// The editor reads the tree through SWR; the picker's own drill is covered by
// ServiceAreaSelect.test.tsx, so here we only need the tree to resolve. Imported
// inside the factory because `vi.mock` is hoisted above the module's imports.
vi.mock("@/hooks/useCategoryTree", async () => {
  const { flattenCategories } =
    await import("@/app/(dashboard)/elements/_lib/categoryUtils");
  const { CATEGORY_TREE } = await import("@/test/fixtures/categoryTree");
  return {
    useCategoryTree: () => ({
      tree: CATEGORY_TREE,
      options: flattenCategories(CATEGORY_TREE),
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

/**
 * Drill the composer's picker down to a leaf and pick it. Queries by role, not
 * text: an assigned chip names its leaf too, so `getByText` goes ambiguous the
 * moment the vendor already covers the area we're picking.
 */
function pick(leaf: string) {
  fireEvent.click(
    screen.getByRole("button", { name: /serviceAreaPlaceholder/ })
  );
  fireEvent.click(screen.getByRole("button", { name: "Kitchen" }));
  fireEvent.click(screen.getByRole("button", { name: "Cabinets" }));
  fireEvent.click(screen.getByRole("button", { name: leaf }));
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

  // The area is what's being listed, so it leads; the path is context, kept
  // because "Base Units" alone doesn't say which Base Units.
  it("lists an assigned area with the service area leading its path", () => {
    renderEditor([BASE]);

    const chip = screen.getByRole("listitem");
    expect(chip.textContent).toContain("Kitchen › Cabinets › Base Units");
    expect(within(chip).getByText("Base Units")).toBeDefined();
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
