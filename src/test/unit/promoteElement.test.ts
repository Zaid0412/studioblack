import { describe, it, expect, vi, beforeEach } from "vitest";

// Run the REAL promoteElement against a shape-routed pool to pin the contract:
// only Custom → Company Standard, org-scoped, and the code/history are untouched.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mockQuery }) }));

import { promoteElement } from "@/lib/queries/elements";

beforeEach(() => mockQuery.mockReset());

describe("promoteElement", () => {
  it("promotes a Custom element to Company Standard without re-coding it", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "el-1", element_type: "company_standard" }],
    });

    const res = await promoteElement("org-1", "el-1");
    expect(res).toEqual({ id: "el-1", element_type: "company_standard" });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toContain("element_type = 'company_standard'");
    expect(String(sql)).toContain("element_type = 'custom'"); // only Custom promotes
    expect(String(sql)).toContain("org_id = $2"); // org-scoped
    expect(String(sql)).not.toMatch(/\bcode\s*=/); // code preserved
    expect(params).toEqual(["el-1", "org-1"]);
  });

  it("returns null when the element isn't Custom or doesn't exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await promoteElement("org-1", "el-1")).toBeNull();
  });
});
