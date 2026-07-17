// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BoqItemsPickerTable } from "@/app/(dashboard)/projects/[id]/order/rfq/_components/BoqItemsPickerTable";
import type { BoqItemWithComputed } from "@/types";

afterEach(cleanup);

/** Minimal item — the picker only reads id/code/description/unit/quantity. */
const item = (over: Partial<BoqItemWithComputed>): BoqItemWithComputed =>
  ({
    id: "x",
    item_code: "KIT-0001",
    description: "Item",
    unit: "no",
    quantity: 1,
    element_id: null,
    ...over,
  }) as BoqItemWithComputed;

const labels = {
  selectAll: "Select all",
  code: "Code",
  description: "Description",
  unit: "Unit",
  quantity: "Qty",
};

const ITEMS = [
  item({ id: "a", description: "Free item" }),
  item({ id: "b", description: "Committed item" }),
];
const DISABLED = { b: { label: "Already in an RFQ", tone: "bg-info/10" } };

function renderTable(
  props: Partial<Parameters<typeof BoqItemsPickerTable>[0]> = {}
) {
  return render(
    <BoqItemsPickerTable
      items={ITEMS}
      selected={new Set()}
      onToggleItem={vi.fn()}
      onToggleAll={vi.fn()}
      labels={labels}
      disabledReasons={DISABLED}
      {...props}
    />
  );
}

const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("BoqItemsPickerTable — disabled rows", () => {
  it("shows the reason and disables only the committed row's checkbox", () => {
    renderTable();
    expect(screen.getByText("Already in an RFQ")).toBeTruthy();
    expect(box("Committed item").disabled).toBe(true);
    expect(box("Free item").disabled).toBe(false);
  });

  it("ignores a click on a disabled row but toggles a selectable one", () => {
    const onToggleItem = vi.fn();
    renderTable({ onToggleItem });
    fireEvent.click(screen.getByText("Committed item"));
    expect(onToggleItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Free item"));
    expect(onToggleItem).toHaveBeenCalledWith("a");
  });

  it("counts select-all against selectable rows only, not disabled ones", () => {
    // Only the one selectable item is selected → header reads fully checked,
    // even though a disabled item remains (old logic compared against all rows).
    renderTable({ selected: new Set(["a"]) });
    expect(box("Select all").checked).toBe(true);
  });
});
