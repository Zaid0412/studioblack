import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DESIGN_PACKAGE_DEFAULTS,
  DISCIPLINE_DEFAULTS,
} from "@/lib/designTemplates";

/**
 * Contract for the Document Control PR-1 seed/read queries:
 *  - disciplines seed with one idempotent guarded INSERT (per-org backfill-safe)
 *  - packages seed 6-per-project via the caller's transaction client
 *  - reads are scoped + ordered
 */
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mockQuery }) }));

import {
  seedDefaultDisciplines,
  getDesignDisciplines,
  seedDesignPackages,
  getDesignPackages,
} from "@/lib/queries/designPackages";

beforeEach(() => mockQuery.mockReset());

describe("seedDefaultDisciplines", () => {
  it("issues one idempotent INSERT with every default code + name", async () => {
    mockQuery.mockResolvedValue({ rowCount: DISCIPLINE_DEFAULTS.length });

    const added = await seedDefaultDisciplines("org-1");

    expect(added).toBe(DISCIPLINE_DEFAULTS.length);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO design_discipline");
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("lower(x.code) = lower(d.code)");
    expect(params[0]).toBe("org-1");
    expect(params[1]).toEqual(DISCIPLINE_DEFAULTS.map((d) => d.code));
    expect(params[2]).toEqual(DISCIPLINE_DEFAULTS.map((d) => d.name));
  });

  it("returns 0 when every default already exists (re-run)", async () => {
    mockQuery.mockResolvedValue({ rowCount: 0 });
    expect(await seedDefaultDisciplines("org-1")).toBe(0);
  });
});

describe("getDesignDisciplines", () => {
  it("reads active disciplines for the org, ordered", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: "d1" }] });
    const rows = await getDesignDisciplines("org-1");
    expect(rows).toEqual([{ id: "d1" }]);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM design_discipline");
    expect(sql).toContain("is_active = true");
    expect(sql).toContain("ORDER BY sort_order");
    expect(params).toEqual(["org-1"]);
  });
});

describe("seedDesignPackages", () => {
  it("inserts the 6 defaults via the caller's transaction client", async () => {
    const client = { query: vi.fn().mockResolvedValue({}) };
    await seedDesignPackages(
      client as unknown as import("pg").PoolClient,
      "proj-1",
      "org-1"
    );

    expect(client.query).toHaveBeenCalledTimes(1);
    // Not the pooled connection — must run inside the project-create transaction.
    expect(mockQuery).not.toHaveBeenCalled();
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO design_package");
    expect(params[0]).toBe("proj-1");
    expect(params[1]).toBe("org-1");
    expect(params[2]).toEqual(DESIGN_PACKAGE_DEFAULTS.map((p) => p.code));
    expect(params[3]).toEqual(DESIGN_PACKAGE_DEFAULTS.map((p) => p.name));
  });
});

describe("getDesignPackages", () => {
  it("reads the project's packages, ordered", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: "p1" }] });
    const rows = await getDesignPackages("proj-1");
    expect(rows).toEqual([{ id: "p1" }]);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM design_package WHERE project_id = $1");
    expect(sql).toContain("ORDER BY sort_order");
    expect(params).toEqual(["proj-1"]);
  });
});
