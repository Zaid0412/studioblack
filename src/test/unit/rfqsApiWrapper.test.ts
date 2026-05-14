/**
 * Pin the client-side URL marshalling. The list endpoint uses query-string
 * filters and the wrapper must drop undefined keys (otherwise the server
 * sees `status=undefined` and Zod fails the enum check).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as rfqs from "@/lib/api/rfqs";

describe("rfqs API wrapper", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ rows: [], total: 0, page: 1, limit: 25 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const PROJECT_ID = "proj-1";

  it("list() with no filters omits the query string", async () => {
    await rfqs.list(PROJECT_ID);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/rfqs`,
      undefined
    );
  });

  it("list() encodes provided filters and skips undefined keys", async () => {
    await rfqs.list(PROJECT_ID, { status: "issued", page: 2 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("status=issued");
    expect(url).toContain("page=2");
    expect(url).not.toContain("limit=");
    expect(url).not.toContain("search=");
  });

  it("listKey() matches the GET URL list() would call", async () => {
    const key = rfqs.listKey(PROJECT_ID, { status: "issued" });
    await rfqs.list(PROJECT_ID, { status: "issued" });
    expect(fetchMock.mock.calls[0][0]).toBe(key);
  });

  it("vendorList() targets the portal endpoint", async () => {
    await rfqs.vendorList();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vendor-portal/rfqs",
      undefined
    );
  });

  it("suggestedVendors() builds the per-rfq URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ vendors: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await rfqs.suggestedVendors(PROJECT_ID, "rfq-1");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/rfqs/rfq-1/suggested-vendors`,
      undefined
    );
  });
});
