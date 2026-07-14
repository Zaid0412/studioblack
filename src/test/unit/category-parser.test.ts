import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseCategorySheet } from "@/lib/excel/categoryParser";
import { writeCategorySheet } from "@/lib/excel/categoryWriter";
import { categoryNode } from "../fixtures/categoryTree";

const HEADERS = [
  "Category",
  "Category Code",
  "Sub-category",
  "Sub-category Code",
  "Service Area",
  "Service Area Code",
];

async function xlsx(rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Categories");
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const csv = (rows: string[][]): Buffer =>
  Buffer.from([HEADERS, ...rows].map((r) => r.join(",")).join("\n"), "utf8");

const KITCHEN = ["Kitchen", "KIT", "Cabinets", "CAB", "Base Cabinets", "BASE"];

describe("parseCategorySheet", () => {
  it("reads a chain and composes each rung's code onto its parent", async () => {
    const result = await parseCategorySheet(await xlsx([KITCHEN]));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.path).toEqual([
      { name: "Kitchen", codePrefix: "KIT" },
      { name: "Cabinets", codePrefix: "KIT-CAB" },
      { name: "Base Cabinets", codePrefix: "KIT-CAB-BASE" },
    ]);
  });

  // CSV goes through the same ExcelJS worksheet the xlsx path yields, so the
  // parser never learns which one it got. This pins that.
  it("reads a CSV identically", async () => {
    const fromCsv = await parseCategorySheet(csv([KITCHEN]), "csv");
    const fromXlsx = await parseCategorySheet(await xlsx([KITCHEN]));

    expect(fromCsv.rows[0].parsed).toEqual(fromXlsx.rows[0].parsed);
  });

  /**
   * "Doors, Windows & Glass" is a real category on dev. A CSV that didn't quote
   * it would split it into two columns and shift the whole row along by one.
   */
  it("reads a quoted CSV field containing a comma", async () => {
    const rows = [
      HEADERS.join(","),
      '"Doors, Windows & Glass",DWG,Windows,WIN,UPVC Windows,UPV',
    ].join("\n");
    const result = await parseCategorySheet(Buffer.from(rows, "utf8"), "csv");

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.path[0]).toEqual({
      name: "Doors, Windows & Glass",
      codePrefix: "DWG",
    });
    expect(result.rows[0].parsed?.path[2].codePrefix).toBe("DWG-WIN-UPV");
  });

  // A Sub-category may exist before anyone has filed a Service Area under it.
  it("accepts a row that stops at the Sub-category", async () => {
    const result = await parseCategorySheet(
      await xlsx([["Kitchen", "KIT", "Cabinets", "CAB", "", ""]])
    );

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.path).toHaveLength(2);
  });

  /**
   * The tree allows a Category with nothing under it, so the sheet has to be
   * able to say so. A format that couldn't would drop those nodes on a
   * round-trip — and the diff would read the absence as "delete them".
   */
  it("accepts a row that stops at the Category", async () => {
    const result = await parseCategorySheet(
      await xlsx([["Smart Home", "SMT", "", "", "", ""]])
    );

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].parsed?.path).toEqual([
      { name: "Smart Home", codePrefix: "SMT" },
    ]);
  });

  it("rejects a row with no Category at all", async () => {
    const result = await parseCategorySheet(
      await xlsx([["", "", "Cabinets", "CAB", "", ""]])
    );

    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors).toContain("Category is required");
  });

  it("rejects a Sub-category Code with no Sub-category", async () => {
    const result = await parseCategorySheet(
      await xlsx([["Kitchen", "KIT", "", "CAB", "", ""]])
    );

    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors[0]).toMatch(/without a Sub-category/);
  });

  // A code without the node it belongs to is a half-filled row, not a branch
  // that stops early — saying so beats silently dropping the code.
  it("rejects a Service Area Code with no Service Area", async () => {
    const result = await parseCategorySheet(
      await xlsx([["Kitchen", "KIT", "Cabinets", "CAB", "", "BASE"]])
    );

    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors[0]).toMatch(/without a Service Area/);
  });

  it("rejects a composed code longer than the column allows", async () => {
    const result = await parseCategorySheet(
      await xlsx([
        ["Kitchen", "KITCHENARE", "Cabinets", "CABINETRY", "Base", "BASEUNITS"],
      ])
    );

    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors[0]).toMatch(/longer than 20/);
  });

  it("rejects a code with nothing usable in it", async () => {
    const result = await parseCategorySheet(
      await xlsx([["Kitchen", "!!!", "Cabinets", "CAB", "", ""]])
    );

    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].errors[0]).toMatch(/no letters or digits/);
  });

  it("rejects the same path declared twice", async () => {
    const result = await parseCategorySheet(await xlsx([KITCHEN, KITCHEN]));

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("error");
    expect(result.rows[1].errors[0]).toMatch(/Duplicate path/);
  });

  /**
   * The same node coded two ways is a typo, and the last-write-wins reading of
   * it would cascade a wrong code into every child.
   */
  it("rejects a node given two different codes on different rows", async () => {
    const result = await parseCategorySheet(
      await xlsx([
        KITCHEN,
        ["Kitchen", "KTC", "Cabinets", "CAB", "Wall Cabinets", "WALL"],
      ])
    );

    expect(result.rows[1].status).toBe("error");
    expect(result.rows[1].errors[0]).toMatch(/coded .* but .* earlier/);
  });

  it("warns when a coded parent has an uncoded child", async () => {
    const result = await parseCategorySheet(
      await xlsx([["Kitchen", "KIT", "Cabinets", "", "", ""]])
    );

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].warnings[0]).toMatch(/no code/);
  });

  /**
   * The load-bearing invariant: what the exporter writes, the parser must read
   * back whole. Anything the sheet can't express goes missing from the
   * re-import, and the diff reads missing as *deleted* — so a node the format
   * drops is a node the round-trip silently destroys.
   */
  it("round-trips every node the tree allows, including childless ones", async () => {
    const coded = (id: string, name: string, level: 1 | 2 | 3, code: string) =>
      Object.assign(categoryNode(id, name, level), { code_prefix: code });

    const tree = [
      // A Category with a full chain under it.
      Object.assign(coded("kit", "Kitchen", 1, "KIT"), {
        children: [
          Object.assign(coded("cab", "Cabinets", 2, "KIT-CAB"), {
            children: [coded("base", "Base Units", 3, "KIT-CAB-BASE")],
          }),
          // A Sub-category with no Service Areas yet.
          coded("ctp", "Countertops", 2, "KIT-CTP"),
        ],
      }),
      // A Category with nothing under it at all.
      coded("smt", "Smart Home", 1, "SMT"),
    ];

    const parsed = await parseCategorySheet(await writeCategorySheet(tree));
    const paths = parsed.rows.map((r) =>
      r.parsed!.path.map((n) => `${n.name}:${n.codePrefix}`).join(" > ")
    );

    expect(parsed.rows.every((r) => r.status === "valid")).toBe(true);
    expect(paths).toEqual([
      "Kitchen:KIT > Cabinets:KIT-CAB > Base Units:KIT-CAB-BASE",
      "Kitchen:KIT > Countertops:KIT-CTP",
      "Smart Home:SMT",
    ]);
  });

  it("reports the required columns when the sheet is empty", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Categories");
    const result = await parseCategorySheet(
      Buffer.from(await wb.xlsx.writeBuffer())
    );

    expect(result.rows).toHaveLength(0);
    expect(result.missingColumns).toContain("Category");
  });
});
