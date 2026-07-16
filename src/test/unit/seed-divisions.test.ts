import { describe, it, expect, vi, beforeEach } from "vitest";
import { DIVISION_DEFAULTS } from "@/lib/divisionTemplates";

/**
 * `seedDefaultDivisions` inserts the default library idempotently — the INSERT …
 * WHERE NOT EXISTS keyed on (org_id, lower(code)) means a re-run only adds codes
 * that are missing. We assert the single guarded INSERT and its payload.
 */
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

import { seedDefaultDivisions } from "@/lib/queries/divisions";

beforeEach(() => mockQuery.mockReset());

describe("seedDefaultDivisions", () => {
  it("issues one idempotent INSERT with all default codes and names", async () => {
    mockQuery.mockResolvedValue({ rowCount: DIVISION_DEFAULTS.length });

    const added = await seedDefaultDivisions("org-1");

    expect(added).toBe(DIVISION_DEFAULTS.length);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO division");
    // Idempotent guard.
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("lower(x.code) = lower(d.code)");
    // Payload carries every default code + name, in order.
    expect(params[0]).toBe("org-1");
    expect(params[1]).toEqual(DIVISION_DEFAULTS.map((d) => d.code));
    expect(params[2]).toEqual(DIVISION_DEFAULTS.map((d) => d.name));
  });

  it("returns 0 when every default already exists (re-run)", async () => {
    mockQuery.mockResolvedValue({ rowCount: 0 });
    expect(await seedDefaultDivisions("org-1")).toBe(0);
  });
});
