/** Utility for converting Fortune Sheet data back to xlsx format. */

interface MergeInfo {
  r: number;
  c: number;
  rs: number;
  cs: number;
}

interface FortuneSheetCell {
  r: number;
  c: number;
  v: {
    v: string | number | boolean | null;
    m?: string;
    ct?: { fa: string; t: string };
    bl?: number;
    it?: number;
    fc?: string;
    bg?: string;
    fs?: number;
    ht?: number;
    vt?: number;
    mc?: MergeInfo;
  };
}

interface FortuneSheetData {
  name: string;
  celldata?: FortuneSheetCell[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[][];
  order: number;
  row?: number;
  column?: number;
  config?: {
    merge?: Record<string, MergeInfo>;
    columnlen?: Record<string, number>;
    rowlen?: Record<string, number>;
    [key: string]: unknown;
  };
}

/**
 * Convert Fortune Sheet data back to an xlsx ArrayBuffer using SheetJS.
 * Preserves cell values, merged cells, column widths, and row heights.
 * Style support is limited by SheetJS community edition.
 */
export async function fortuneSheetToXlsx(
  sheets: FortuneSheetData[]
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const ws: Record<string, unknown> = {};
    let maxRow = 0;
    let maxCol = 0;
    let hasCells = false;

    if (sheet.celldata && Array.isArray(sheet.celldata)) {
      // Original format: sparse array of {r, c, v}
      for (const cell of sheet.celldata) {
        if (cell.v == null) continue;
        const addr = XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
        maxRow = Math.max(maxRow, cell.r);
        maxCol = Math.max(maxCol, cell.c);
        hasCells = true;

        const cellType = cell.v.ct?.t === "n" ? "n" : "s";
        const cellValue = cell.v.v;

        if (cellValue == null || cellValue === "") continue;
        ws[addr] = {
          v: cellType === "n" ? Number(cellValue) : String(cellValue),
          t: cellType,
        };
      }
    } else if (sheet.data && Array.isArray(sheet.data)) {
      // Fortune Sheet internal format: 2D array [row][col] of cell objects
      for (let r = 0; r < sheet.data.length; r++) {
        const row = sheet.data[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (!cell || cell.v == null) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          maxRow = Math.max(maxRow, r);
          maxCol = Math.max(maxCol, c);
          hasCells = true;

          const cellType = cell.ct?.t === "n" ? "n" : "s";
          const cellValue = cell.v;

          if (cellValue == null || cellValue === "") continue;
          ws[addr] = {
            v: cellType === "n" ? Number(cellValue) : String(cellValue),
            t: cellType,
          };
        }
      }
    }

    if (!hasCells) continue;

    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxRow, c: maxCol },
    });

    // Restore merged cells
    if (sheet.config?.merge) {
      ws["!merges"] = Object.values(sheet.config.merge).map((m: MergeInfo) => ({
        s: { r: m.r, c: m.c },
        e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 },
      }));
    }

    // Restore column widths
    if (sheet.config?.columnlen) {
      const cols: { wpx: number }[] = [];
      for (const [i, w] of Object.entries(sheet.config.columnlen)) {
        cols[Number(i)] = { wpx: w };
      }
      ws["!cols"] = cols;
    }

    // Restore row heights
    if (sheet.config?.rowlen) {
      const rows: { hpx: number }[] = [];
      for (const [i, h] of Object.entries(sheet.config.rowlen)) {
        rows[Number(i)] = { hpx: h };
      }
      ws["!rows"] = rows;
    }

    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
