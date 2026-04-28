import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vendors from "@/lib/api/vendors";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => vi.clearAllMocks());

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VID = "11111111-1111-4111-8111-111111111111";

describe("vendors API client", () => {
  // ── list ──────────────────────────────────────────────────────────────────

  it("list — calls bare URL with no options", async () => {
    mockFetch.mockResolvedValue(okJson({ rows: [], total: 0, page: 1, limit: 25 }));
    await vendors.list();
    expect(mockFetch).toHaveBeenCalledWith("/api/vendors", undefined);
  });

  it("list — appends search/status/trade/page/limit", async () => {
    mockFetch.mockResolvedValue(okJson({ rows: [], total: 0, page: 1, limit: 25 }));
    await vendors.list({
      search: "acme",
      status: "active",
      tradeCategoryId: "cat-1",
      page: 2,
      limit: 10,
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("search=acme");
    expect(url).toContain("status=active");
    expect(url).toContain("tradeCategoryId=cat-1");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
  });

  it("listKey — returns same URL shape as list", () => {
    expect(vendors.listKey({ search: "x" })).toBe("/api/vendors?search=x");
    expect(vendors.listKey()).toBe("/api/vendors");
  });

  // ── single ────────────────────────────────────────────────────────────────

  it("get — fetches single vendor", async () => {
    mockFetch.mockResolvedValue(okJson({ id: VID }));
    await vendors.get(VID);
    expect(mockFetch).toHaveBeenCalledWith(`/api/vendors/${VID}`, undefined);
  });

  // ── mutations ─────────────────────────────────────────────────────────────

  it("create — POSTs to /api/vendors", async () => {
    mockFetch.mockResolvedValue(okJson({ id: VID }, 201));
    await vendors.create({ companyName: "Acme" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/vendors");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ companyName: "Acme" }));
  });

  it("update — PATCHes /api/vendors/:id", async () => {
    mockFetch.mockResolvedValue(okJson({ id: VID }));
    await vendors.update(VID, { tradingName: "Acme Trading" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/vendors/${VID}`);
    expect((init as RequestInit).method).toBe("PATCH");
  });

  it("remove — DELETEs /api/vendors/:id (soft)", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true, mode: "soft" }));
    await vendors.remove(VID);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/vendors/${VID}`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("removeHard — DELETEs with ?hard=true", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true, mode: "hard" }));
    await vendors.removeHard(VID);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/vendors/${VID}?hard=true`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  // ── bank details ──────────────────────────────────────────────────────────

  it("getBankDetails — GETs the bank-details endpoint", async () => {
    mockFetch.mockResolvedValue(okJson({ data: null }));
    await vendors.getBankDetails(VID);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/vendors/${VID}/bank-details`,
      undefined
    );
  });

  it("updateBankDetails — PUTs envelope { data }", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true }));
    await vendors.updateBankDetails(VID, { iban: "GB29..." });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/vendors/${VID}/bank-details`);
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ data: { iban: "GB29..." } })
    );
  });

  it("updateBankDetails(null) — PUTs { data: null }", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true }));
    await vendors.updateBankDetails(VID, null);
    expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ data: null }));
  });

  // ── rating ────────────────────────────────────────────────────────────────

  it("updateRating — PATCHes /rating with { rating }", async () => {
    mockFetch.mockResolvedValue(okJson({ id: VID, rating: 4.5 }));
    await vendors.updateRating(VID, 4.5);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/vendors/${VID}/rating`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ rating: 4.5 }));
  });

  // ── by trade ──────────────────────────────────────────────────────────────

  it("listByTrade — GETs /by-trade/:categoryId", async () => {
    mockFetch.mockResolvedValue(okJson({ rows: [] }));
    await vendors.listByTrade("cat-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/vendors/by-trade/cat-1",
      undefined
    );
  });
});
