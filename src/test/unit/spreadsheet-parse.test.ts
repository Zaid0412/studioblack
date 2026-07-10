/**
 * Unit test for the spreadsheet parse/normalize transform that moved off the
 * main thread into `spreadsheet.worker.ts` (perf t4-06). The worker is a thin
 * wrapper around `parseWorkbookToSheets`; testing that function here verifies
 * the Fortune Sheet output shape (cells, styles, merges, widths) stays correct
 * — the verification that a headless run can't do against the rendered grid.
 */
import { describe, it, expect } from "vitest";
import * as ExcelJS from "exceljs";
import { parseWorkbookToSheets } from "@/components/review/spreadsheet-parse";

/** Build an in-memory xlsx exercising every branch of the transform. */
async function buildFixture(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");

  const a1 = ws.getCell("A1");
  a1.value = "Title";
  a1.font = { bold: true, size: 14, color: { argb: "FFFF0000" } };
  a1.alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell("B1").value = 42; // number

  const c1 = ws.getCell("C1");
  c1.value = "x";
  c1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00FF00" },
  };

  ws.mergeCells("A2:B2"); // merged origin at A2
  ws.getCell("A2").value = "merged";

  ws.getColumn(1).width = 20; // → columnlen["0"] = 160

  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

describe("parseWorkbookToSheets", () => {
  it("normalizes cells, styles, merges, and column widths", async () => {
    const sheets = await parseWorkbookToSheets(await buildFixture());
    expect(sheets).toHaveLength(1);
    const s = sheets[0];
    expect(s.name).toBe("Sheet1");

    const at = (r: number, c: number) =>
      s.celldata.find((cd) => cd.r === r && cd.c === c)?.v;

    // A1 — bold, size, red text, center-aligned, middle vertical.
    const a1 = at(0, 0)!;
    expect(a1.v).toBe("Title");
    expect(a1.bl).toBe(1);
    expect(a1.fs).toBe(14);
    expect(a1.fc).toBe("#FF0000"); // argb "FFFF0000" → strip alpha
    expect(a1.ht).toBe(0); // center
    expect(a1.vt).toBe(0); // middle

    // B1 — number typed as "n".
    const b1 = at(0, 1)!;
    expect(b1.v).toBe(42);
    expect(b1.ct?.t).toBe("n");

    // C1 — solid green fill.
    expect(at(0, 2)!.bg).toBe("#00FF00");

    // A2 — merge origin tagged with the correct span (1 row × 2 cols).
    expect(at(1, 0)!.mc).toEqual({ r: 1, c: 0, rs: 1, cs: 2 });

    // config carries the merge map + the scaled column width.
    expect(s.config?.merge).toHaveProperty("1_0");
    expect((s.config?.columnlen as Record<string, number>)["0"]).toBe(160);
  });

  it("parses CSV content (not a zip) into a typed cell grid", async () => {
    const csv =
      'Name,Role,Score\nAlice,PM,88\n"Last, First","a ""quoted"" role",7\n';
    const buf = new TextEncoder().encode(csv).buffer as ArrayBuffer;

    const sheets = await parseWorkbookToSheets(buf);
    expect(sheets).toHaveLength(1);
    const s = sheets[0];
    const at = (r: number, c: number) =>
      s.celldata.find((cd) => cd.r === r && cd.c === c)?.v;

    // Header text.
    expect(at(0, 0)!.v).toBe("Name");
    // Numeric cell typed as "n".
    expect(at(1, 2)!.v).toBe(88);
    expect(at(1, 2)!.ct?.t).toBe("n");
    // Quoted field with an embedded comma stays one cell.
    expect(at(2, 0)!.v).toBe("Last, First");
    // Escaped "" quotes decode to a single quote.
    expect(at(2, 1)!.v).toBe('a "quoted" role');
  });

  it("returns a sheet entry with no cells for an empty worksheet", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Empty");
    const buf = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;

    const sheets = await parseWorkbookToSheets(buf);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].celldata).toEqual([]);
    // Falls back to the minimum 50×26 grid.
    expect(sheets[0].row).toBe(50);
    expect(sheets[0].column).toBe(26);
  });
});
