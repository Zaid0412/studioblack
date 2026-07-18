import { describe, it, expect, vi, beforeEach } from "vitest";

// Execute the REAL deleteDivision against a shape-routed pool to assert its
// in-use guard now covers BOTH sections and lines — a line's `division_id` is
// mandatory, so a referenced division can't be hard-deleted.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mockQuery }) }));

import { deleteDivision } from "@/lib/queries/divisions";

beforeEach(() => mockQuery.mockReset());

describe("deleteDivision — in-use guard", () => {
  it("blocks the delete while a section OR a line references the division", async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 }) // conditional DELETE removed nothing
      .mockResolvedValueOnce({ rows: [{ in_use: true }] }); // probe: still referenced

    const res = await deleteDivision("div-1", "org-1");
    expect(res).toEqual({
      deleted: false,
      error: expect.stringContaining("in use"),
    });

    // The conditional DELETE guards on both tables.
    const deleteSql = String(mockQuery.mock.calls[0][0]);
    expect(deleteSql).toContain(
      "NOT EXISTS (SELECT 1 FROM boq_section WHERE division_id = $1)"
    );
    expect(deleteSql).toContain(
      "NOT EXISTS (SELECT 1 FROM boq_item WHERE division_id = $1)"
    );
    // The in-use probe checks lines too.
    expect(String(mockQuery.mock.calls[1][0])).toContain(
      "FROM boq_item WHERE division_id = $1"
    );
  });

  it("deletes (no probe) when nothing references it", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await deleteDivision("div-1", "org-1");
    expect(res).toEqual({ deleted: true });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
