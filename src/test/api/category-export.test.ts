import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCategoryTree, buildCategoryTree } from "@/lib/queries";
import { GET as GET_EXPORT } from "@/app/api/element-categories/export/route";
import { buildRequest, mockSession, setupAuth } from "../helpers";
import { mocks } from "../setup";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(getCategoryTree).mockResolvedValue([]);
  vi.mocked(buildCategoryTree).mockReturnValue([]);
});

describe("GET /api/element-categories/export", () => {
  it("returns an xlsx with the right content-type and dated attachment filename", async () => {
    const res = await GET_EXPORT(
      buildRequest("/api/element-categories/export")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="categories-\d{4}-\d{2}-\d{2}\.xlsx"/
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("builds the sheet from the org's taxonomy tree", async () => {
    await GET_EXPORT(buildRequest("/api/element-categories/export"));
    expect(getCategoryTree).toHaveBeenCalledWith("org-test-001");
    expect(buildCategoryTree).toHaveBeenCalled();
  });

  it("denies client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET_EXPORT(
      buildRequest("/api/element-categories/export")
    );
    expect(res.status).toBe(403);
  });
});
