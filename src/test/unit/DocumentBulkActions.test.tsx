// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

import { DocumentBulkActions } from "@/app/(dashboard)/projects/[id]/documents/_components/DocumentBulkActions";
import type { DbProjectDocumentSection } from "@/types";

const SECTION_A: DbProjectDocumentSection = {
  id: "11111111-1111-4111-8111-111111111111",
  project_id: "proj-1",
  name: "Minutes of Meeting",
  icon: "Folder",
  position: 0,
  created_by: "u-1",
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
  doc_count: 0,
};

const SECTION_B: DbProjectDocumentSection = {
  ...SECTION_A,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Site Photos",
  icon: "Image",
  position: 1,
};

describe("DocumentBulkActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("fires onMove with the chosen section id when a section is clicked in the popover", () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    render(
      <DocumentBulkActions
        sections={[SECTION_A, SECTION_B]}
        onMove={onMove}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Move to section/i }));
    fireEvent.click(screen.getByRole("button", { name: SECTION_B.name }));
    expect(onMove).toHaveBeenCalledWith(SECTION_B.id);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("fires onDelete when the Delete button is clicked", () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    render(
      <DocumentBulkActions
        sections={[SECTION_A]}
        onMove={onMove}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("disables the Move trigger when there are no target sections", () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    render(
      <DocumentBulkActions sections={[]} onMove={onMove} onDelete={onDelete} />
    );
    const moveBtn = screen.getByRole("button", { name: /Move to section/i });
    expect((moveBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
