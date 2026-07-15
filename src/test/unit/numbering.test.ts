import { describe, it, expect } from "vitest";
import {
  DOC_TYPES,
  nextProjectNumber,
  nextDocumentNumber,
} from "@/lib/queries/sequences";

/**
 * A stand-in for the counter row. Each call returns the next value for its
 * `(prefix, year)` key, so a test can advance the same sequence twice and see it
 * count. Also records the args the query was called with.
 */
function fakeExecutor() {
  const counters = new Map<string, number>();
  const calls: { prefix: string; year: number }[] = [];
  return {
    calls,
    query: async (_sql: string, params: unknown[]) => {
      const [, prefix, year] = params as [string, string, number, number];
      calls.push({ prefix, year });
      const key = `${prefix}:${year}`;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return { rows: [{ current_value: next }] };
    },
  };
}

describe("nextProjectNumber", () => {
  it("formats as P{year}-NNN with the P glued to the year", async () => {
    const exec = fakeExecutor();
    const year = new Date().getUTCFullYear();

    const number = await nextProjectNumber(exec as never, "org-1");

    expect(number).toBe(`P${year}-001`);
    // Per-org, per-year counter under the bare "P" prefix.
    expect(exec.calls[0]).toEqual({ prefix: "P", year });
  });

  it("counts up within the same org and year", async () => {
    const exec = fakeExecutor();
    const year = new Date().getUTCFullYear();

    await nextProjectNumber(exec as never, "org-1");
    const second = await nextProjectNumber(exec as never, "org-1");

    expect(second).toBe(`P${year}-002`);
  });
});

describe("nextDocumentNumber", () => {
  it("roots the number in the project and never carries a year", async () => {
    const exec = fakeExecutor();

    const number = await nextDocumentNumber(
      exec as never,
      "org-1",
      "P2026-001",
      DOC_TYPES.BOQ
    );

    expect(number).toBe("P2026-001-BOQ-001");
    // Prefix is the whole project+type; year sentinel 0 = never resets.
    expect(exec.calls[0]).toEqual({ prefix: "P2026-001-BOQ", year: 0 });
  });

  it("counts independently per type under the same project", async () => {
    const exec = fakeExecutor();

    await nextDocumentNumber(
      exec as never,
      "org-1",
      "P2026-001",
      DOC_TYPES.BOQ
    );
    const boq2 = await nextDocumentNumber(
      exec as never,
      "org-1",
      "P2026-001",
      DOC_TYPES.BOQ
    );
    const rfq1 = await nextDocumentNumber(
      exec as never,
      "org-1",
      "P2026-001",
      DOC_TYPES.RFQ
    );

    expect(boq2).toBe("P2026-001-BOQ-002");
    expect(rfq1).toBe("P2026-001-RFQ-001");
  });

  it("keeps every type's prefix within the counter's 20-char cap", () => {
    // The counter column is VARCHAR(20); the longest realistic project number is
    // P{year}-NNN (9 chars), so the widest prefix is the longest doc type on it.
    for (const type of Object.values(DOC_TYPES)) {
      const prefix = `P2026-001-${type}`;
      expect(prefix.length).toBeLessThanOrEqual(20);
    }
  });
});
