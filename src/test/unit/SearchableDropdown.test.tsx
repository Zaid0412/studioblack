// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { useState } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { SearchableDropdown } from "@/components/ui/SearchableDropdown";

interface Option {
  code: string;
  name: string;
}

const OPTIONS: Option[] = [
  { code: "m2", name: "square meter" },
  { code: "m3", name: "cubic meter" },
  { code: "kg", name: "kilogram" },
  { code: "pcs", name: "pieces" },
];

function Harness({ onPick }: { onPick?: (code: string) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <SearchableDropdown
      minContentWidth={200}
      isEmpty={OPTIONS.length === 0}
      trigger={<button type="button">{value ?? "select unit"}</button>}
    >
      {(query, close) => {
        const filtered = query
          ? OPTIONS.filter(
              (o) =>
                o.code.toLowerCase().includes(query) ||
                o.name.toLowerCase().includes(query)
            )
          : OPTIONS;
        if (filtered.length === 0) return <p>no results</p>;
        return filtered.map((o) => (
          <button
            key={o.code}
            type="button"
            onClick={() => {
              setValue(o.code);
              onPick?.(o.code);
              close();
            }}
          >
            {o.code} — {o.name}
          </button>
        ));
      }}
    </SearchableDropdown>
  );
}

describe("SearchableDropdown", () => {
  afterEach(cleanup);

  it("opens on trigger click, filters on input, selects and closes", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    // Closed initially — options not in the DOM.
    expect(screen.queryByText(/cubic meter/)).toBeNull();

    // Open
    fireEvent.click(screen.getByRole("button", { name: "select unit" }));
    expect(screen.getByText(/square meter/)).toBeDefined();
    expect(screen.getByText(/cubic meter/)).toBeDefined();

    // Filter by typing "kil" — only kg row should remain.
    const searchInput = screen.getByPlaceholderText("search");
    fireEvent.change(searchInput, { target: { value: "kil" } });
    expect(screen.queryByText(/square meter/)).toBeNull();
    expect(screen.getByText(/kilogram/)).toBeDefined();

    // Select — calls onPick and dismisses the popover.
    fireEvent.click(screen.getByText(/kilogram/));
    expect(onPick).toHaveBeenCalledWith("kg");
    expect(screen.queryByText(/kilogram/)).toBeNull();

    // Trigger now reflects the new value.
    expect(screen.getByRole("button", { name: "kg" })).toBeDefined();
  });

  it("shows empty state when isEmpty is true", () => {
    render(
      <SearchableDropdown
        isEmpty={true}
        emptyLabel="nothing here"
        trigger={<button type="button">open</button>}
      >
        {() => <div>should not render</div>}
      </SearchableDropdown>
    );
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByText("nothing here")).toBeDefined();
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("resets search query when the popover closes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "select unit" }));
    const searchInput = screen.getByPlaceholderText(
      "search"
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "xyz" } });
    expect(searchInput.value).toBe("xyz");

    // Close via Escape — Radix Popover listens on keyDown.
    fireEvent.keyDown(searchInput, { key: "Escape", code: "Escape" });

    // Reopen — search input should be empty again.
    fireEvent.click(screen.getByRole("button", { name: "select unit" }));
    const reopened = screen.getByPlaceholderText("search") as HTMLInputElement;
    expect(reopened.value).toBe("");
  });
});
