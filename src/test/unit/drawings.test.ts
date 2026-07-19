import { describe, it, expect, vi } from "vitest";
import type { PoolClient } from "pg";
import { nextDrawingNumber } from "@/lib/queries/sequences";
import { createDrawing } from "@/lib/queries/drawings";

/**
 * Document Control PR-2 numbering + drawing creation. `createDrawing` is run
 * against a shape-routed mock transaction client to pin: classified uploads
 * resolve the discipline code, draw a `P2026-001-AR-PLAN-001` number from the
 * shared counter, and insert; unclassified uploads insert null metadata.
 */

/** A mock transaction client that routes by SQL fragment. */
function mockClient(routes: {
  disciplineCode?: string | null;
  counterValue?: number;
  drawingRow?: Record<string, unknown>;
}): { client: PoolClient; calls: Array<[string, unknown[]]> } {
  const calls: Array<[string, unknown[]]> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push([sql, params]);
    if (/FROM design_discipline/.test(sql)) {
      return {
        rows: routes.disciplineCode ? [{ code: routes.disciplineCode }] : [],
      };
    }
    if (/INTO sequence_counter/.test(sql)) {
      return { rows: [{ current_value: routes.counterValue ?? 1 }] };
    }
    if (/INSERT INTO drawing/.test(sql)) {
      return {
        rows: [
          routes.drawingRow ?? {
            id: "dr-1",
            version_group: "vg-1",
            document_number: (params[4] as string) ?? null,
          },
        ],
      };
    }
    return { rows: [] };
  });
  return { client: { query } as unknown as PoolClient, calls };
}

describe("nextDrawingNumber", () => {
  it("formats `P2026-001-AR-PLAN-001` from a two-segment counter prefix", async () => {
    const { client, calls } = mockClient({ counterValue: 1 });
    const num = await nextDrawingNumber(
      client,
      "org-1",
      "P2026-001",
      "AR",
      "PLAN"
    );
    expect(num).toBe("P2026-001-AR-PLAN-001");
    // Counter keyed on the whole discipline+type prefix, never-reset (year 0).
    expect(calls[0][1]).toEqual(["org-1", "P2026-001-AR-PLAN", 0, 1]);
  });

  it("zero-pads the sequence to 3 digits", async () => {
    const { client } = mockClient({ counterValue: 42 });
    expect(
      await nextDrawingNumber(client, "o", "P2026-001", "HVAC", "SECT")
    ).toBe("P2026-001-HVAC-SECT-042");
  });
});

describe("createDrawing", () => {
  it("classified: resolves discipline code, numbers, and inserts", async () => {
    const { client, calls } = mockClient({
      disciplineCode: "AR",
      counterValue: 1,
    });

    const res = await createDrawing(client, {
      projectId: "proj-1",
      orgId: "org-1",
      projectNumber: "P2026-001",
      disciplineId: "dis-1",
      drawingType: "PLAN",
      title: "Ground Floor",
    });

    expect(res.documentNumber).toBe("P2026-001-AR-PLAN-001");
    // Discipline resolved org-scoped, then the drawing inserted with the number.
    expect(calls[0][0]).toContain("FROM design_discipline");
    expect(calls[0][1]).toEqual(["dis-1", "org-1"]);
    const insert = calls.find(([sql]) => /INSERT INTO drawing/.test(sql))!;
    expect(insert[1]).toEqual([
      "proj-1",
      "org-1",
      "dis-1",
      "PLAN",
      "P2026-001-AR-PLAN-001",
      "Ground Floor",
    ]);
  });

  it("unclassified: inserts null discipline/type/number, no counter draw", async () => {
    const { client, calls } = mockClient({});

    const res = await createDrawing(client, {
      projectId: "proj-1",
      orgId: "org-1",
      projectNumber: "P2026-001",
    });

    expect(res.documentNumber).toBeNull();
    expect(calls.some(([sql]) => /sequence_counter/.test(sql))).toBe(false);
    const insert = calls.find(([sql]) => /INSERT INTO drawing/.test(sql))!;
    expect(insert[1]).toEqual(["proj-1", "org-1", null, null, null, null]);
  });

  it("throws when the discipline isn't found in the org", async () => {
    const { client } = mockClient({ disciplineCode: null });
    await expect(
      createDrawing(client, {
        projectId: "proj-1",
        orgId: "org-1",
        projectNumber: "P2026-001",
        disciplineId: "bad",
        drawingType: "PLAN",
      })
    ).rejects.toThrow("Discipline not found");
  });

  it("rejects a half-classified drawing (discipline without type)", async () => {
    const { client } = mockClient({ disciplineCode: "AR" });
    await expect(
      createDrawing(client, {
        projectId: "proj-1",
        orgId: "org-1",
        projectNumber: "P2026-001",
        disciplineId: "dis-1",
      })
    ).rejects.toThrow("required together");
  });
});
