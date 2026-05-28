// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

import { SectionSidebar } from "@/app/(dashboard)/projects/[id]/documents/_components/SectionSidebar";
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

function renderSidebar(
  sections: DbProjectDocumentSection[],
  activeSectionId: string | null = null
) {
  return render(
    <SectionSidebar
      sections={sections}
      activeSectionId={activeSectionId}
      onSelect={vi.fn()}
      onCreate={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      onReorder={vi.fn()}
      onMove={vi.fn()}
      canEdit={true}
    />
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("SectionSidebar — expand/collapse", () => {
  it("renders no chevron for a section with no children", () => {
    renderSidebar([section("s1", "Leaf only")]);
    // The single section has no children → no aria-label exposing expand/collapse.
    expect(
      screen.queryByRole("button", { name: /Expand|Collapse/i })
    ).toBeNull();
  });

  it("shows the chevron for a parent and expands by default", () => {
    const parent = section("p", "Contracts");
    const child = section("c", "Subcontractors", {
      parent_id: "p",
      position: 0,
    });
    renderSidebar([parent, child]);
    // Parent's chevron is in "Collapse" state when expanded.
    expect(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    ).toBeDefined();
    expect(screen.getByText("Subcontractors")).toBeDefined();
  });

  it("toggles children visibility via the chevron", () => {
    const parent = section("p", "Contracts");
    const child = section("c", "Subcontractors", {
      parent_id: "p",
      position: 0,
    });
    renderSidebar([parent, child]);
    // Initial state: chevron exposes "Collapse" → children visible.
    expect(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    ).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    );
    // After click: chevron label flips to Expand, child wrapper is aria-hidden.
    expect(
      screen.getByRole("button", { name: /Expand Contracts/i })
    ).toBeDefined();
    // The grid-rows wrapper that contains the child has class "grid" and
    // aria-hidden=true when collapsed (separate from the phantom-chevron
    // span on "All documents", which has fixed sizing classes).
    const collapsedWrapper = document.querySelector(
      '.grid[aria-hidden="true"]'
    );
    expect(collapsedWrapper).not.toBeNull();
  });

  it("force-expands the parent of the currently active sub-section", () => {
    const parent = section("p", "Contracts");
    const child = section("c", "Subcontractors", {
      parent_id: "p",
      position: 0,
    });
    renderSidebar([parent, child], "c");
    // Active sub-section's parent is force-included in the expanded set →
    // chevron reads "Collapse" and the child row is visible.
    expect(
      screen.getByRole("button", { name: /Collapse Contracts/i })
    ).toBeDefined();
    expect(screen.getByText("Subcontractors")).toBeDefined();
  });

  it("rolls the parent's doc_count into the badge without double-counting at the top", () => {
    const parent = section("p", "Contracts", { doc_count: 12 });
    const sibling = section("o", "Other top-level", {
      position: 1,
      doc_count: 4,
    });
    const a = section("a", "Subcontractors", {
      parent_id: "p",
      position: 0,
      doc_count: 7,
    });
    const b = section("b", "Vendor agreements", {
      parent_id: "p",
      position: 1,
      doc_count: 5,
    });
    renderSidebar([parent, sibling, a, b]);
    // "All documents" sums top-level only (12 + 4 = 16). If the sidebar
    // double-counted children (12 + 4 + 7 + 5 = 28), this would fail.
    expect(screen.getByText("16")).toBeDefined();
    // Parent + children render their own counts.
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
  });
});
