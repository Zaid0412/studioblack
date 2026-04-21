import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import {
  parseElementSheet,
  buildCategoryPathMap,
  buildCategoryPathById,
  TEMPLATE_COLUMN_LABELS,
} from "@/lib/excel/elementParser";
import type { ElementCategory } from "@/types";

// ── Test fixtures ───────────────────────────────────────────────────────────

function makeCategory(
  id: string,
  name: string,
  parent_id: string | null,
  level: 1 | 2 | 3
): ElementCategory {
  return {
    id,
    org_id: "org-1",
    name,
    parent_id,
    level,
    code_prefix: null,
    sort_order: 0,
    icon: null,
    color: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const CATEGORIES: ElementCategory[] = [
  makeCategory("cat-f", "Finishes", null, 1),
  makeCategory("cat-wf", "Wall Finishes", "cat-f", 2),
  makeCategory("cat-pt", "Paint", "cat-wf", 3),
  makeCategory("cat-fl", "Flooring", null, 1),
];

async function buildSheet(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Elements");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const HEADERS = [
  TEMPLATE_COLUMN_LABELS.code,
  TEMPLATE_COLUMN_LABELS.name,
  TEMPLATE_COLUMN_LABELS.categoryPath,
  TEMPLATE_COLUMN_LABELS.unit,
  TEMPLATE_COLUMN_LABELS.unitCost,
  TEMPLATE_COLUMN_LABELS.currency,
  TEMPLATE_COLUMN_LABELS.overheadPct,
  TEMPLATE_COLUMN_LABELS.tags,
];

// ── Path map helpers ────────────────────────────────────────────────────────

describe("buildCategoryPathMap", () => {
  it("builds case-insensitive normalized paths", () => {
    const map = buildCategoryPathMap(CATEGORIES);
    expect(map.get("finishes")).toBe("cat-f");
    expect(map.get("finishes > wall finishes")).toBe("cat-wf");
    expect(map.get("finishes > wall finishes > paint")).toBe("cat-pt");
    expect(map.get("flooring")).toBe("cat-fl");
  });
});

describe("buildCategoryPathById", () => {
  it("returns the segment array for each category id", () => {
    const map = buildCategoryPathById(CATEGORIES);
    expect(map.get("cat-pt")).toEqual(["Finishes", "Wall Finishes", "Paint"]);
    expect(map.get("cat-fl")).toEqual(["Flooring"]);
  });
});

// ── Parse ───────────────────────────────────────────────────────────────────

describe("parseElementSheet", () => {
  it("parses a fully valid row", async () => {
    const buf = await buildSheet(HEADERS, [
      [
        "WAL-PNT-001",
        "White Matte Paint",
        "Finishes > Wall Finishes > Paint",
        "m2",
        12.5,
        "USD",
        10,
        "interior, matte",
      ],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.missingColumns).toEqual([]);
    expect(result.unknownColumns).toEqual([]);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.status).toBe("valid");
    expect(row.errors).toEqual([]);
    expect(row.parsed).toEqual({
      rowNumber: 1,
      code: "WAL-PNT-001",
      name: "White Matte Paint",
      categoryPath: ["Finishes", "Wall Finishes", "Paint"],
      unit: "m2",
      unitCost: 12.5,
      currency: "USD",
      overheadPct: 10,
      tags: ["interior", "matte"],
    });
  });

  it("flags missing required columns", async () => {
    const buf = await buildSheet(
      ["Code", "Name", "Description"],
      [["X1", "Thing", "notes"]]
    );
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.missingColumns).toEqual(
      expect.arrayContaining(["Unit", "Unit Cost"])
    );
  });

  it("lists unknown columns as warnings", async () => {
    const buf = await buildSheet(
      [...HEADERS, "Mystery Col"],
      [["A", "B", "Flooring", "m2", 1, "USD", 0, "", "???"]]
    );
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.unknownColumns).toContain("Mystery Col");
  });

  it("errors on disallowed unit", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "xyz", 1, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("error");
    expect(row.parsed).toBeNull();
    expect(row.errors.some((e) => e.includes('Unit "xyz"'))).toBe(true);
  });

  it("errors on negative unit cost", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", -5, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("error");
    expect(row.errors.some((e) => e.includes("Unit Cost"))).toBe(true);
  });

  it("errors when overhead percent is out of range", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", 10, "USD", 150, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("error");
    expect(row.errors.some((e) => e.includes("Overhead %"))).toBe(true);
  });

  it("errors on unknown category path", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Nonexistent > Path", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("error");
    expect(row.errors.some((e) => e.includes("Category path"))).toBe(true);
  });

  it("resolves category path case-insensitively", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "FINISHES > wall finishes", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("valid");
    expect(row.parsed?.categoryPath).toEqual(["FINISHES", "wall finishes"]);
  });

  it("flags duplicate codes within the sheet", async () => {
    const buf = await buildSheet(HEADERS, [
      ["DUP-1", "First", "Flooring", "m2", 10, "USD", 0, ""],
      ["DUP-1", "Second", "Flooring", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("error");
    expect(result.rows[1].errors[0]).toContain("Duplicate code");
  });

  it("accepts numeric cells for cost fields", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", 12.75, "USD", 5.5, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].parsed?.unitCost).toBe(12.75);
    expect(result.rows[0].parsed?.overheadPct).toBe(5.5);
  });
});

// ── Smoke: empty workbook ───────────────────────────────────────────────────

describe("parseElementSheet edge cases", () => {
  let emptyBuf: Buffer;
  beforeAll(async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Elements"); // no rows at all
    const b = await wb.xlsx.writeBuffer();
    emptyBuf = Buffer.from(b);
  });

  it("returns zero rows and all required columns as missing for an empty sheet", async () => {
    const result = await parseElementSheet(emptyBuf, CATEGORIES);
    expect(result.rows).toHaveLength(0);
    expect(result.missingColumns).toEqual(
      expect.arrayContaining(["Code", "Name", "Unit", "Unit Cost"])
    );
  });
});
