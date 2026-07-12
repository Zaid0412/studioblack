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
  it("builds case-preserving normalized paths", () => {
    // Case is preserved so "PVC" and "Pvc" don't collide in the lookup —
    // categories differing only by case remain individually addressable.
    const map = buildCategoryPathMap(CATEGORIES);
    expect(map.get("Finishes")).toBe("cat-f");
    expect(map.get("Finishes > Wall Finishes")).toBe("cat-wf");
    expect(map.get("Finishes > Wall Finishes > Paint")).toBe("cat-pt");
    expect(map.get("Flooring")).toBe("cat-fl");
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

describe("parseElementSheet — client_rate / budget_rate", () => {
  it("parses Client Rate + Budget Rate when present in the sheet", async () => {
    const headers = [
      TEMPLATE_COLUMN_LABELS.code,
      TEMPLATE_COLUMN_LABELS.name,
      TEMPLATE_COLUMN_LABELS.unit,
      TEMPLATE_COLUMN_LABELS.unitCost,
      TEMPLATE_COLUMN_LABELS.clientRate,
      TEMPLATE_COLUMN_LABELS.budgetRate,
    ];
    const buf = await buildSheet(headers, [
      ["X-1", "Item", "m2", 100, 175, 85],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.clientRate).toBe(175);
    expect(result.rows[0].parsed?.budgetRate).toBe(85);
  });

  it("treats blank rate cells as undefined (no value, not zero)", async () => {
    const headers = [
      TEMPLATE_COLUMN_LABELS.code,
      TEMPLATE_COLUMN_LABELS.name,
      TEMPLATE_COLUMN_LABELS.unit,
      TEMPLATE_COLUMN_LABELS.unitCost,
      TEMPLATE_COLUMN_LABELS.clientRate,
      TEMPLATE_COLUMN_LABELS.budgetRate,
    ];
    const buf = await buildSheet(headers, [["X-2", "Item", "m2", 100, "", ""]]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.clientRate).toBeUndefined();
    expect(result.rows[0].parsed?.budgetRate).toBeUndefined();
  });

  it("rejects negative rate values", async () => {
    const headers = [
      TEMPLATE_COLUMN_LABELS.code,
      TEMPLATE_COLUMN_LABELS.name,
      TEMPLATE_COLUMN_LABELS.unit,
      TEMPLATE_COLUMN_LABELS.unitCost,
      TEMPLATE_COLUMN_LABELS.clientRate,
    ];
    const buf = await buildSheet(headers, [["X-3", "Item", "m2", 100, -10]]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors.join(" ")).toMatch(/client rate/i);
  });
});

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

  it("requires category path to match the DB case exactly", async () => {
    // Case-sensitive lookup — "FINISHES" no longer resolves to "Finishes".
    // Preserves the ability to distinguish e.g. "PVC" from "Pvc".
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "FINISHES > wall finishes", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("error");
    expect(row.errors.some((e) => /[Cc]ategory/.test(e))).toBe(true);
  });

  it("resolves category path with exact case", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Finishes > Wall Finishes", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    const row = result.rows[0];
    expect(row.status).toBe("valid");
    expect(row.parsed?.categoryPath).toEqual(["Finishes", "Wall Finishes"]);
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
      expect.arrayContaining(["Name", "Unit", "Unit Cost"])
    );
    // Code is optional now — a sheet without it is valid, every row just gets
    // a generated code.
    expect(result.missingColumns).not.toContain("Code");
  });
});

// ── Cell-value extraction branches ──────────────────────────────────────────

describe("parseElementSheet cell extraction", () => {
  it("reads formula results as the underlying value", async () => {
    // Build a workbook with a formula cell (=10+2) whose cached result is 12.
    // parser must pull `.result`, not stringify the formula object.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Elements");
    ws.addRow(HEADERS);
    const row = ws.addRow(["A", "B", "Flooring", "m2", null, "USD", 0, ""]);
    // Column 5 is "Unit Cost" — write a formula that evaluates to 12.
    row.getCell(5).value = { formula: "10+2", result: 12 };
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.unitCost).toBe(12);
  });

  it("flags formula-error cells rather than parsing '[object Object]'", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Elements");
    ws.addRow(HEADERS);
    const row = ws.addRow(["A", "B", "Flooring", "m2", null, "USD", 0, ""]);
    // Simulate =1/0 with error payload on .result.
    row.getCell(5).value = {
      formula: "1/0",
      result: { error: "#DIV/0!" },
    } as unknown as ExcelJS.CellFormulaValue;
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("error");
    // Treated as missing/empty unit cost, not an opaque "[object Object]".
    expect(result.rows[0].errors.join(" ")).not.toContain("[object Object]");
  });

  it("reads rich-text header as plain text", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Elements");
    // Build a rich-text "Code" header — common when pasted from Word/Docs.
    const headerRow = ws.addRow(HEADERS);
    headerRow.getCell(1).value = {
      richText: [{ text: "Code" }],
    } as ExcelJS.CellRichTextValue;
    ws.addRow(["R1", "B", "Flooring", "m2", 10, "USD", 0, ""]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.missingColumns).toEqual([]);
    expect(result.rows[0].parsed?.code).toBe("R1");
  });

  it("strips BOM and whitespace from headers", async () => {
    // Real-world uploads often land with \uFEFF-prefixed headers after a
    // cross-platform round-trip through a non-UTF-8 editor.
    const bomHeaders = HEADERS.map((h, i) => (i === 0 ? `\uFEFF ${h} ` : h));
    const buf = await buildSheet(bomHeaders, [
      ["A", "B", "Flooring", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.missingColumns).toEqual([]);
    expect(result.rows[0].parsed?.code).toBe("A");
  });

  it("parses Turkish-locale decimal strings (comma as decimal)", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", "12,5", "TRY", "10,25", ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.unitCost).toBe(12.5);
    expect(result.rows[0].parsed?.overheadPct).toBe(10.25);
  });

  it("parses European mixed thousands/decimal (1.234,56 → 1234.56)", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", "1.234,56", "EUR", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].parsed?.unitCost).toBe(1234.56);
  });

  it("warns on ambiguous single-comma/3-digit values (1,234 → 1.234 + warning)", async () => {
    // "1,234" could be decimal (1.234) or thousands (1234). Parser picks
    // decimal to match the Turkey-market default but flags the row so the
    // preview can surface a "check this" notice.
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", "1,234", "TRY", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.unitCost).toBe(1.234);
    expect(result.rows[0].warnings.length).toBeGreaterThan(0);
    expect(result.rows[0].warnings[0]).toMatch(/Unit Cost/);
  });

  it("does not warn on unambiguous single-comma/2-digit values (1,5)", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", "1,5", "TRY", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].parsed?.unitCost).toBe(1.5);
    expect(result.rows[0].warnings).toEqual([]);
  });
});

// ── Category path edge cases ────────────────────────────────────────────────

describe("parseElementSheet category path", () => {
  it("rejects category paths with empty segments", async () => {
    // "A > > B" would collapse silently and match a different category.
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Finishes > > Wall Finishes", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors.some((e) => /[Cc]ategory/.test(e))).toBe(true);
  });
});

// ── Parse-result diagnostics ────────────────────────────────────────────────

describe("parseElementSheet diagnostics", () => {
  it("surfaces duplicate template headers", async () => {
    const buf = await buildSheet(
      [...HEADERS, "Code"],
      [["A", "B", "Flooring", "m2", 10, "USD", 0, "", "DUPE-Z"]]
    );
    const result = await parseElementSheet(buf, CATEGORIES);
    expect(result.duplicateColumns ?? []).toContain("Code");
  });

  it("exposes excelRowNumber pointing at the 1-based sheet row", async () => {
    const buf = await buildSheet(HEADERS, [
      ["A", "B", "Flooring", "m2", 10, "USD", 0, ""],
    ]);
    const result = await parseElementSheet(buf, CATEGORIES);
    // Header is row 1, first data row is Excel row 2.
    expect(result.rows[0].excelRowNumber).toBe(2);
  });

  it("sorts missingColumns by template order", async () => {
    // Only provide Description + Currency — Code, Name, Unit, Unit Cost are
    // all missing. Order must match TEMPLATE_COLUMN_ORDER, not insertion
    // order of the headers we supplied.
    const buf = await buildSheet(
      ["Description", "Currency"],
      [["notes", "USD"]]
    );
    const result = await parseElementSheet(buf, CATEGORIES);
    const missing = result.missingColumns;
    // Code must appear before Unit, Unit must appear before Unit Cost.
    expect(missing.indexOf("Code")).toBeLessThan(missing.indexOf("Unit"));
    expect(missing.indexOf("Unit")).toBeLessThan(missing.indexOf("Unit Cost"));
  });
});
