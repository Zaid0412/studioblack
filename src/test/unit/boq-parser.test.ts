import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseBoqSheet } from "@/lib/excel/boqParser";
import { writeBoqSheet } from "@/lib/excel/boqWriter";
import type { BoqElementLite, BoqItemWithComputed, BoqSection } from "@/types";

const HEADERS = [
  "Section",
  "Item Code",
  "Description",
  "Unit",
  "Quantity",
  "Unit Cost",
  "Material Cost",
  "Labour Cost",
  "Overhead %",
  "Margin %",
  "Notes",
  "Client Notes",
  "Is Provisional",
];

async function sheetBuffer(
  rows: (string | number | null | undefined)[][],
  headers: (string | null)[] = HEADERS
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BOQ");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const EMPTY_MAP = new Map<string, BoqElementLite>();

describe("parseBoqSheet", () => {
  it("parses a minimal valid row and derives defaults for missing optional columns", async () => {
    const buf = await sheetBuffer([
      ["Concrete", "BOQ-001", "100mm slab", "m2", 50, 45],
    ]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.missingColumns).toEqual([]);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed).toMatchObject({
      sectionTitle: "Concrete",
      itemCode: "BOQ-001",
      description: "100mm slab",
      unit: "m2",
      quantity: 50,
      unitCost: 45,
    });
  });

  it("flags rows missing required fields as errors", async () => {
    const buf = await sheetBuffer([
      [null, "", "", "m2", 50, 45], // missing Description
      ["Concrete", "", "Item", "", 50, 45], // missing Unit
      ["Concrete", "", "Item", "m2", null, 45], // missing Quantity
      ["Concrete", "", "Item", "m2", 50, null], // missing Unit Cost
    ]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows).toHaveLength(4);
    expect(res.rows.every((r) => r.status === "error")).toBe(true);
    expect(res.rows[0].errors.join(" ")).toMatch(/Description is required/);
    expect(res.rows[1].errors.join(" ")).toMatch(/Unit is required/);
    expect(res.rows[2].errors.join(" ")).toMatch(/Quantity is required/);
    expect(res.rows[3].errors.join(" ")).toMatch(/Unit Cost is required/);
  });

  it("rejects units outside the ALLOWED_UNITS enum", async () => {
    const buf = await sheetBuffer([["", "", "Item", "zzz", 1, 1]]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("error");
    expect(res.rows[0].errors.join(" ")).toMatch(/Unit "zzz"/);
  });

  it("treats unit input case-insensitively", async () => {
    const buf = await sheetBuffer([["", "", "Item", "M2", 1, 1]]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.unit).toBe("m2");
  });

  it("warns on ambiguous decimal-comma (e.g. '1,234')", async () => {
    const buf = await sheetBuffer([["", "", "Item", "m2", "1,234", 5]]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.quantity).toBeCloseTo(1.234);
    expect(res.rows[0].warnings.join(" ")).toMatch(/ambiguous/);
  });

  it("reports missing required columns on an incomplete header row", async () => {
    const buf = await sheetBuffer(
      [["desc only"]],
      ["Description"] // missing Unit + Quantity + Unit Cost
    );
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.missingColumns).toEqual(
      expect.arrayContaining(["Unit", "Quantity", "Unit Cost"])
    );
  });

  it("parses a Service Charge % column when present", async () => {
    // Header includes the new column; verify it round-trips into the parsed row.
    const buf = await sheetBuffer(
      [["", "", "Item", "m2", 1, 10, null, null, null, 7.5, 12]],
      [
        "Section",
        "Item Code",
        "Description",
        "Unit",
        "Quantity",
        "Unit Cost",
        "Material Cost",
        "Labour Cost",
        "Overhead %",
        "Service Charge %",
        "Margin %",
      ]
    );
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.serviceChargePct).toBe(7.5);
    expect(res.rows[0].parsed?.marginPct).toBe(12);
  });

  it("tolerates an older sheet missing the Service Charge % column", async () => {
    // Same minimal-row test as the first case, but assert the new field is
    // simply absent on the parsed row instead of breaking the import.
    const buf = await sheetBuffer([
      ["Concrete", "BOQ-001", "100mm slab", "m2", 50, 45],
    ]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.serviceChargePct).toBeUndefined();
    expect(res.missingColumns).toEqual([]);
  });

  it("records unknown (non-template) header labels", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BOQ");
    ws.addRow(["Description", "Unit", "Quantity", "Unit Cost", "Mystery"]);
    ws.addRow(["Item", "m2", 1, 1, "x"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.unknownColumns).toContain("Mystery");
  });

  it("links rows to elements when itemCode matches the provided map", async () => {
    const map = new Map<string, BoqElementLite>([
      ["WAL-PNT-001", { id: "el-1", code: "WAL-PNT-001", name: "White Paint" }],
    ]);
    const buf = await sheetBuffer([
      ["Finishes", "WAL-PNT-001", "Paint", "m2", 1, 1],
    ]);

    const res = await parseBoqSheet(buf, map);

    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].linkedElement).toMatchObject({
      id: "el-1",
      code: "WAL-PNT-001",
    });
  });

  it("treats isProvisional 'yes' as true and 'no' as false", async () => {
    const buf = await sheetBuffer([
      ["", "", "A", "m2", 1, 1, "", "", "", "", "", "", "yes"],
      ["", "", "B", "m2", 1, 1, "", "", "", "", "", "", "no"],
    ]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].parsed?.isProvisional).toBe(true);
    expect(res.rows[1].parsed?.isProvisional).toBe(false);
  });

  it("rejects unparseable isProvisional values", async () => {
    const buf = await sheetBuffer([
      ["", "", "A", "m2", 1, 1, "", "", "", "", "", "", "maybe"],
    ]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("error");
    expect(res.rows[0].errors.join(" ")).toMatch(/Is Provisional/);
  });

  it("enforces Overhead %/Margin % 0–100 bounds", async () => {
    const buf = await sheetBuffer([["", "", "A", "m2", 1, 1, "", "", 150, ""]]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows[0].status).toBe("error");
    expect(res.rows[0].errors.join(" ")).toMatch(/Overhead %/);
  });

  it("gracefully handles an empty workbook", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("BOQ");
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await parseBoqSheet(buf, EMPTY_MAP);

    expect(res.rows).toEqual([]);
    expect(res.missingColumns.length).toBeGreaterThan(0);
  });

  it("returns the literal Excel row index for preview + result messages", async () => {
    const buf = await sheetBuffer([
      ["", "", "A", "m2", 1, 1],
      ["", "", "B", "m2", 2, 2],
    ]);
    const res = await parseBoqSheet(buf, EMPTY_MAP);

    // Header is Excel row 1, so first data row is 2. `rowNumber` carries
    // the Excel row everywhere — preview, parsed.rowNumber (sent to confirm),
    // and the server's failed[].rowNumber that comes back.
    expect(res.rows[0].rowNumber).toBe(2);
    expect(res.rows[1].rowNumber).toBe(3);
    expect(res.rows[0].parsed?.rowNumber).toBe(2);
  });
});

describe("parseBoqSheet — dimensions", () => {
  const HEADERS_WITH_DIMS = [
    "Item Code",
    "Description",
    "Unit",
    "Quantity",
    "Unit Cost",
    "Length",
    "Breadth",
    "Height",
  ];

  it("parses Length / Breadth / Height when all three are filled", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BOQ");
    ws.addRow(HEADERS_WITH_DIMS);
    ws.addRow(["", "Concrete footing", "m3", 1.875, 200, 2.5, 1.5, 0.5]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await parseBoqSheet(buf, EMPTY_MAP);
    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.length).toBe(2.5);
    expect(res.rows[0].parsed?.breadth).toBe(1.5);
    expect(res.rows[0].parsed?.height).toBe(0.5);
  });

  it("accepts partial dimensions (only Length + Breadth)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BOQ");
    ws.addRow(HEADERS_WITH_DIMS);
    ws.addRow(["", "Tile area", "m2", 15, 45, 5, 3, ""]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await parseBoqSheet(buf, EMPTY_MAP);
    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.length).toBe(5);
    expect(res.rows[0].parsed?.breadth).toBe(3);
    expect(res.rows[0].parsed?.height).toBeUndefined();
  });

  it("rejects negative dimensions", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BOQ");
    ws.addRow(HEADERS_WITH_DIMS);
    ws.addRow(["", "Bad row", "m3", 1, 1, -1, 1, 1]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await parseBoqSheet(buf, EMPTY_MAP);
    expect(res.rows[0].status).toBe("error");
    expect(res.rows[0].errors.join(" ")).toMatch(/Length/);
  });
});

describe("writeBoqSheet → parseBoqSheet round-trip — dimensions", () => {
  function makeItem(
    overrides: Partial<BoqItemWithComputed>
  ): BoqItemWithComputed {
    return {
      id: "00000000-0000-0000-0000-000000000001",
      boq_id: "00000000-0000-0000-0000-00000000aaaa",
      section_id: null,
      element_id: null,
      item_code: "BOQ-001",
      description: "Concrete footing M25",
      unit: "m3",
      quantity: "1.875",
      unit_cost: "200",
      material_cost: null,
      labour_cost: null,
      overhead_pct: "0",
      service_charge_pct: "0",
      margin_pct: "15",
      client_rate: null,
      budget_rate: null,
      length: "2.5",
      breadth: "1.5",
      height: "0.5",
      source: "custom",
      rate_contract_item_id: null,
      lifecycle_status: "draft",
      client_approval_status: "pending",
      client_approved_at: null,
      client_approved_by: null,
      requires_reapproval: false,
      element_archived: false,
      installed_qty: "0",
      has_snag: false,
      po_status: "none",
      notes: null,
      client_notes: null,
      sort_order: 0,
      is_provisional: false,
      is_excluded: false,
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:00:00Z",
      total_cost: "375",
      subtotal: "431.25",
      sell_price: "230",
      progress_pct: "0",
      margin_alert: false,
      over_budget: false,
      budget_variance_pct: null,
      ...overrides,
    };
  }

  const SECTIONS: BoqSection[] = [];

  it("preserves L/B/H through export → import", async () => {
    const buf = await writeBoqSheet({
      items: [makeItem({})],
      sections: SECTIONS,
    });

    const res = await parseBoqSheet(buf, EMPTY_MAP);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.length).toBe(2.5);
    expect(res.rows[0].parsed?.breadth).toBe(1.5);
    expect(res.rows[0].parsed?.height).toBe(0.5);
  });

  it("leaves dimensions undefined when source row has none", async () => {
    const buf = await writeBoqSheet({
      items: [makeItem({ length: null, breadth: null, height: null })],
      sections: SECTIONS,
    });

    const res = await parseBoqSheet(buf, EMPTY_MAP);
    expect(res.rows[0].status).toBe("valid");
    expect(res.rows[0].parsed?.length).toBeUndefined();
    expect(res.rows[0].parsed?.breadth).toBeUndefined();
    expect(res.rows[0].parsed?.height).toBeUndefined();
  });

  it("round-trips partial dimensions (only L + B)", async () => {
    const buf = await writeBoqSheet({
      items: [makeItem({ length: "5", breadth: "3", height: null })],
      sections: SECTIONS,
    });

    const res = await parseBoqSheet(buf, EMPTY_MAP);
    expect(res.rows[0].parsed?.length).toBe(5);
    expect(res.rows[0].parsed?.breadth).toBe(3);
    expect(res.rows[0].parsed?.height).toBeUndefined();
  });
});
