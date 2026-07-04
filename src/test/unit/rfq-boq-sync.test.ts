import { describe, it, expect, vi, beforeEach } from "vitest";

// Execute the REAL rfq query functions (imported by file path, bypassing the
// global `@/lib/queries` barrel mock) against a controllable pooled client, so
// we can assert the RFQ-3c divergence + sync SQL.
const { mockClientQuery, mockRelease } = vi.hoisted(() => ({
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: () =>
      Promise.resolve({ query: mockClientQuery, release: mockRelease }),
    query: vi.fn(),
  }),
}));

import { boqDivergence, syncRfqItemsFromBoq } from "@/lib/queries/rfqs";

const sqlsOf = () => mockClientQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

describe("boqDivergence (RFQ-3c)", () => {
  it("flags each field that differs", () => {
    const snap = { description: "Base cabinet", unit: "no", quantity: 10 };
    expect(
      boqDivergence(snap, {
        description: "Base cabinet",
        unit: "no",
        quantity: 15,
      })
    ).toEqual([{ field: "quantity", from: 10, to: 15 }]);
    expect(
      boqDivergence(snap, {
        description: "Wall cabinet",
        unit: "rm",
        quantity: 10,
      })
    ).toEqual([
      { field: "description", from: "Base cabinet", to: "Wall cabinet" },
      { field: "unit", from: "no", to: "rm" },
    ]);
  });

  it("returns [] when identical", () => {
    const v = { description: "A", unit: "no", quantity: 5 };
    expect(boqDivergence(v, { ...v })).toEqual([]);
  });
});

describe("syncRfqItemsFromBoq (RFQ-3c)", () => {
  function wire(status: string) {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/FOR UPDATE/.test(sql))
        return Promise.resolve({ rows: [{ status }] });
      if (/UPDATE rfq_item/.test(sql))
        return Promise.resolve({ rows: [], rowCount: 2 });
      return Promise.resolve({ rows: [] });
    });
  }

  it("syncs only quantity on an in-flight RFQ", async () => {
    wire("quotes_received");
    const res = await syncRfqItemsFromBoq("rfq-1");
    expect(res).toEqual({ ok: true, synced: 2 });
    const update = mockClientQuery.mock.calls.find((c) =>
      /UPDATE rfq_item/.test(String(c[0]))
    );
    expect(update).toBeTruthy();
    const sql = String(update![0]);
    expect(sql).toMatch(/SET quantity = bi\.quantity/);
    // Only quantity — description/unit are NOT synced (spec → revision).
    expect(sql).not.toMatch(/description = /);
    expect(sql).not.toMatch(/unit = /);
    expect(sqlsOf()).toContain("COMMIT");
  });

  it("refuses a draft (not in-flight) and rolls back", async () => {
    wire("draft");
    const res = await syncRfqItemsFromBoq("rfq-1");
    expect(res).toEqual({ ok: false, reason: "wrong_status" });
    expect(sqlsOf()).toContain("ROLLBACK");
    expect(sqlsOf().some((s) => /UPDATE rfq_item/.test(s))).toBe(false);
  });

  it("refuses an awarded RFQ", async () => {
    wire("awarded");
    expect(await syncRfqItemsFromBoq("rfq-1")).toEqual({
      ok: false,
      reason: "wrong_status",
    });
  });

  it("returns not_found when the RFQ is gone", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/FOR UPDATE/.test(sql)) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    expect(await syncRfqItemsFromBoq("missing")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
