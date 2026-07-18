import { describe, it, expect, vi, beforeEach } from "vitest";

// Run the REAL findSimilarElements against a shape-routed pool to pin the dedup
// contract: same org + Service Area, description trigram OR tag overlap, ranked,
// active-only, top 5.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mockQuery }) }));

import { findSimilarElements } from "@/lib/queries/elements";

beforeEach(() => mockQuery.mockReset());

describe("findSimilarElements", () => {
  it("matches on Service Area + trigram description / tag overlap, ranked & capped", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "el-1", similarity: 0.6 }] });

    const rows = await findSimilarElements("org-1", {
      categoryId: "cat-1",
      description: "  basin mixer  ",
      tags: ["chrome"],
    });

    expect(rows).toHaveLength(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toContain("e.org_id = $1");
    expect(String(sql)).toContain("e.is_active = true");
    expect(String(sql)).toContain("e.category_id = $2::uuid");
    // trigram description match OR shared keyword
    expect(String(sql)).toContain("lower(e.description) % lower($3)");
    expect(String(sql)).toContain("e.tags && $4::text[]");
    expect(String(sql)).toMatch(/ORDER BY similarity DESC/);
    expect(String(sql)).toContain("LIMIT 5");
    // description is trimmed; tags passed through
    expect(params).toEqual(["org-1", "cat-1", "basin mixer", ["chrome"]]);
  });

  it("passes null tags when none are given", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await findSimilarElements("org-1", {
      categoryId: "cat-1",
      description: "tile",
    });
    expect(mockQuery.mock.calls[0][1]).toEqual(["org-1", "cat-1", "tile", null]);
  });

  it("skips the query for a blank description", async () => {
    const rows = await findSimilarElements("org-1", {
      categoryId: "cat-1",
      description: "   ",
    });
    expect(rows).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
