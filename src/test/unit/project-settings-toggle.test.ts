import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * setPhaseEnabled / setStepEnabled guard against hiding everything: the last
 * enabled phase can't be disabled, and the Design step can't be disabled (the
 * phases hang off it). We route the pooled `query` by SQL shape.
 */
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mockQuery }) }));

import { setPhaseEnabled, setStepEnabled } from "@/lib/queries/projects";

beforeEach(() => mockQuery.mockReset());

describe("setPhaseEnabled", () => {
  it("refuses to disable the last enabled phase", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/COUNT\(\*\)/.test(sql))
        return Promise.resolve({ rows: [{ count: "0" }] });
      return Promise.resolve({ rows: [] });
    });

    await expect(setPhaseEnabled("p1", "ph1", false)).rejects.toThrow(
      /at least one phase/i
    );
    // The UPDATE never ran.
    expect(
      mockQuery.mock.calls.some((c) => /UPDATE project_phase/.test(c[0]))
    ).toBe(false);
  });

  it("disables a phase when others remain enabled", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/COUNT\(\*\)/.test(sql))
        return Promise.resolve({ rows: [{ count: "3" }] });
      return Promise.resolve({ rows: [{ id: "ph1", enabled: false }] });
    });

    const res = await setPhaseEnabled("p1", "ph1", false);
    expect(res).toEqual({ id: "ph1", enabled: false });
  });

  it("skips the guard when enabling", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: "ph1", enabled: true }] });
    await setPhaseEnabled("p1", "ph1", true);
    expect(mockQuery.mock.calls.some((c) => /COUNT/.test(c[0]))).toBe(false);
  });
});

describe("setStepEnabled", () => {
  it("refuses to disable the Design step", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/SELECT name/.test(sql))
        return Promise.resolve({ rows: [{ name: "Design" }] });
      return Promise.resolve({ rows: [] });
    });

    await expect(setStepEnabled("p1", "s1", false)).rejects.toThrow(
      /design step/i
    );
    expect(
      mockQuery.mock.calls.some((c) => /UPDATE project_step/.test(c[0]))
    ).toBe(false);
  });

  it("disables a non-Design step", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/SELECT name/.test(sql))
        return Promise.resolve({ rows: [{ name: "Finance" }] });
      return Promise.resolve({ rows: [{ id: "s1", enabled: false }] });
    });

    const res = await setStepEnabled("p1", "s1", false);
    expect(res).toEqual({ id: "s1", enabled: false });
  });
});
