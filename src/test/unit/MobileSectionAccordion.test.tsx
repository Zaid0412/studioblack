// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

import { MobileSectionAccordion } from "@/app/(dashboard)/projects/[id]/documents/_components/MobileSectionAccordion";
import type { DbProjectDocumentSection } from "@/types";

const PROJECT_ID = "proj-1";

function section(
  id: string,
  name: string,
  overrides: Partial<DbProjectDocumentSection> = {}
): DbProjectDocumentSection {
  return {
    id,
    project_id: PROJECT_ID,
    name,
    icon: "Folder",
    position: 0,
    parent_id: null,
    created_by: "u-1",
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
    doc_count: 0,
    ...overrides,
  };
}

function renderAccordion(
  sections: DbProjectDocumentSection[],
  opts: {
    activeSectionId?: string | null;
    onSelect?: (id: string | null) => void;
    onCreate?: () => void;
    canEdit?: boolean;
  } = {}
) {
  return render(
    <MobileSectionAccordion
      sections={sections}
      activeSectionId={opts.activeSectionId ?? null}
      onSelect={opts.onSelect ?? vi.fn()}
      onCreate={opts.onCreate ?? vi.fn()}
      canEdit={opts.canEdit ?? true}
    />
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("MobileSectionAccordion — header", () => {
  it("defaults the header label to 'All documents' when none active", () => {
    renderAccordion([section("s1", "Contracts", { doc_count: 3 })]);
    expect(
      screen.getByRole("button", { expanded: false, name: /All documents/i })
    ).toBeDefined();
  });

  it("shows the active section's name in the header when one is selected", () => {
    renderAccordion([section("s1", "Contracts")], { activeSectionId: "s1" });
    expect(
      screen.getByRole("button", { expanded: false, name: /Contracts/i })
    ).toBeDefined();
  });

  it("aria-expanded flips on header tap", () => {
    renderAccordion([section("s1", "Contracts")]);
    const header = screen.getByRole("button", { name: /All documents/i });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("MobileSectionAccordion — counts", () => {
  it("sums top-level doc_counts into the header total (no child double-counting)", () => {
    const parent = section("p", "Contracts", { doc_count: 12 });
    const sibling = section("o", "Other", { position: 1, doc_count: 4 });
    const childA = section("a", "Subcontractors", {
      parent_id: "p",
      position: 0,
      doc_count: 7,
    });
    const childB = section("b", "Vendor agreements", {
      parent_id: "p",
      position: 1,
      doc_count: 5,
    });
    renderAccordion([parent, sibling, childA, childB]);
    // Open the dropdown so "All documents" row + counts render.
    fireEvent.click(screen.getByRole("button", { name: /All documents/i }));
    // 12 + 4 = 16. Children's counts should not roll into the header total.
    expect(screen.getAllByText("16").length).toBeGreaterThan(0);
    // Per-row counts still render.
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
  });
});

describe("MobileSectionAccordion — selection", () => {
  it("fires onSelect with null when 'All documents' is tapped, then closes", () => {
    const onSelect = vi.fn();
    renderAccordion([section("s1", "Contracts")], { onSelect });
    const header = screen.getByRole("button", { name: /All documents/i });
    fireEvent.click(header);
    // Inside the dropdown, the "All documents" row is a separate button.
    const rows = screen.getAllByRole("button", { name: /All documents/i });
    // First is the header (now expanded), second is the row inside the panel.
    const allRow = rows.find((b) => b.getAttribute("aria-expanded") === null);
    expect(allRow).toBeDefined();
    fireEvent.click(allRow!);
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("fires onSelect with the section id when a parent row is tapped", () => {
    const onSelect = vi.fn();
    renderAccordion([section("s1", "Contracts")], { onSelect });
    fireEvent.click(screen.getByRole("button", { name: /All documents/i }));
    fireEvent.click(screen.getByRole("button", { name: /Contracts/i }));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });
});

describe("MobileSectionAccordion — children expand/collapse", () => {
  it("renders children expanded by default and toggles via chevron", () => {
    const parent = section("p", "Contracts");
    const child = section("c", "Subcontractors", {
      parent_id: "p",
      position: 0,
    });
    renderAccordion([parent, child]);
    fireEvent.click(screen.getByRole("button", { name: /All documents/i }));
    // Default: parent reads "Collapse" → children visible.
    expect(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    ).toBeDefined();
    expect(screen.getByText("Subcontractors")).toBeDefined();
    // Toggle: chevron flips to Expand label.
    fireEvent.click(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    );
    expect(
      screen.getByRole("button", { name: /Expand Contracts/i })
    ).toBeDefined();
  });

  it("force-expands the parent of the active sub-section", () => {
    const parent = section("p", "Contracts");
    const child = section("c", "Subcontractors", {
      parent_id: "p",
      position: 0,
    });
    renderAccordion([parent, child], { activeSectionId: "c" });
    fireEvent.click(screen.getByRole("button", { name: /Subcontractors/i }));
    // Active sub-section's parent stays expanded — child row is visible.
    expect(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    ).toBeDefined();
  });
});

describe("MobileSectionAccordion — keyboard + canEdit", () => {
  it("Escape closes an open dropdown", () => {
    renderAccordion([section("s1", "Contracts")]);
    const header = screen.getByRole("button", { name: /All documents/i });
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders 'New section' only when canEdit is true", () => {
    const onCreate = vi.fn();
    const { rerender } = renderAccordion([section("s1", "Contracts")], {
      canEdit: true,
      onCreate,
    });
    fireEvent.click(screen.getByRole("button", { name: /All documents/i }));
    const newBtn = screen.getByRole("button", { name: /New section/i });
    fireEvent.click(newBtn);
    expect(onCreate).toHaveBeenCalledTimes(1);

    rerender(
      <MobileSectionAccordion
        sections={[section("s1", "Contracts")]}
        activeSectionId={null}
        onSelect={vi.fn()}
        onCreate={onCreate}
        canEdit={false}
      />
    );
    expect(screen.queryByRole("button", { name: /New section/i })).toBeNull();
  });
});
