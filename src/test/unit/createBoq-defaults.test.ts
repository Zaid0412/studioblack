import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * When a new BOQ header is created and the input omits currency / VAT /
 * contingency / minimum-margin, createBoq falls back to the project's configured
 * BOQ defaults (Settings → BOQ) before the global constants. We run the real
 * query fn against a controllable pooled client, routing by SQL shape.
 */
const { mockQuery, mockRelease } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: () => Promise.resolve({ query: mockQuery, release: mockRelease }),
    query: mockQuery,
  }),
}));

import { createBoq } from "@/lib/queries/boq";

const boqInsertParams = () =>
  mockQuery.mock.calls.find((c) =>
    /INSERT INTO boq /.test(String(c[0]))
  )?.[1] as unknown[] | undefined;

beforeEach(() => {
  mockQuery.mockReset();
  mockRelease.mockReset();
});

describe("createBoq — project BOQ defaults", () => {
  it("pre-fills the header from the project's defaults when input omits them", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/FROM project WHERE id/.test(sql))
        return Promise.resolve({
          rows: [
            {
              org_id: "org-1",
              project_number: "P2026-001",
              default_currency: "USD",
              default_vat_pct: "18.00",
              default_contingency_pct: "5.00",
              default_min_margin_pct: "12.00",
            },
          ],
        });
      if (/INSERT INTO sequence_counter/.test(sql))
        return Promise.resolve({ rows: [{ current_value: 1 }] });
      if (/INSERT INTO boq /.test(sql))
        return Promise.resolve({ rows: [{ id: "boq-1" }] });
      return Promise.resolve({ rows: [] }); // BEGIN / COMMIT
    });

    await createBoq("proj-1", { title: "Main BOQ" });

    const p = boqInsertParams()!;
    // [0]=project_id [1]=boq_number [2]=title [3]=currency [4]=exchange_rate
    // [5]=contingency [6]=vat [7]=minimum_margin
    expect(p[3]).toBe("USD");
    expect(p[5]).toBe("5.00");
    expect(p[6]).toBe("18.00");
    expect(p[7]).toBe("12.00");
  });

  it("prefers explicit input over the project default", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/FROM project WHERE id/.test(sql))
        return Promise.resolve({
          rows: [
            {
              org_id: "org-1",
              project_number: "P2026-001",
              default_currency: "USD",
              default_vat_pct: "18.00",
              default_contingency_pct: "5.00",
              default_min_margin_pct: "12.00",
            },
          ],
        });
      if (/INSERT INTO sequence_counter/.test(sql))
        return Promise.resolve({ rows: [{ current_value: 1 }] });
      if (/INSERT INTO boq /.test(sql))
        return Promise.resolve({ rows: [{ id: "boq-1" }] });
      return Promise.resolve({ rows: [] });
    });

    await createBoq("proj-1", {
      title: "Main BOQ",
      currency: "EUR",
      vatPct: 9,
    });

    const p = boqInsertParams()!;
    expect(p[3]).toBe("EUR"); // explicit wins
    expect(p[6]).toBe(9); // explicit wins
    expect(p[5]).toBe("5.00"); // still falls back to the project default
  });
});
