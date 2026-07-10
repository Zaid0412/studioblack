import * as ExcelJS from "exceljs";
import type { FortuneSheetCell, FortuneSheetData } from "./spreadsheet-types";

/**
 * Parse + normalize an Excel workbook buffer into Fortune Sheet data.
 *
 * Pure (no DOM) so it runs in the parse worker (`spreadsheet.worker.ts`) and is
 * directly unit-testable. Output shape must stay identical to what `<Workbook>`
 * consumes — see `spreadsheet-parse.test.ts`.
 */
export async function parseWorkbookToSheets(
  buffer: ArrayBuffer
): Promise<FortuneSheetData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets.map((ws, idx) => {
    const celldata: FortuneSheetCell[] = [];
    const merges: { r: number; c: number; rs: number; cs: number }[] = [];

    // Parse merged cells
    for (const mergeRange of ws.model.merges ?? []) {
      // mergeRange is "A1:C3" — use worksheet's built-in decoding
      const [topLeft, bottomRight] = mergeRange.split(":");
      const tl = ws.getCell(topLeft);
      const br = ws.getCell(bottomRight);
      const tlRow = Number(tl.row);
      const tlCol = Number(tl.col);
      const brRow = Number(br.row);
      const brCol = Number(br.col);
      merges.push({
        r: tlRow - 1,
        c: tlCol - 1,
        rs: brRow - tlRow + 1,
        cs: brCol - tlCol + 1,
      });
    }

    // Build merge lookup for tagging cells
    const mergeMap = new Map<
      string,
      { r: number; c: number; rs: number; cs: number }
    >();
    for (const m of merges) {
      mergeMap.set(`${m.r},${m.c}`, m);
    }

    // Parse column widths. `ws.columns` is null for a worksheet with no
    // columns (e.g. an empty tab in a multi-sheet workbook) — guard so one
    // empty sheet doesn't crash the whole viewer.
    const columnWidths: Record<string, number> = {};
    (ws.columns ?? []).forEach((col, i) => {
      if (col.width) columnWidths[String(i)] = Number(col.width) * 8;
    });

    // Parse row heights
    const rowHeights: Record<string, number> = {};
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (row.height) rowHeights[String(row.number - 1)] = row.height;
    });

    // Parse cells
    let maxRow = 0;
    let maxCol = 0;

    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const r = Number(cell.row) - 1;
        const c = Number(cell.col) - 1;
        if (r > maxRow) maxRow = r;
        if (c > maxCol) maxCol = c;

        let rawValue: string | number | boolean | null;
        if (cell.value instanceof Date) {
          rawValue = cell.value.toLocaleDateString();
        } else if (
          cell.value != null &&
          typeof cell.value === "object" &&
          "result" in cell.value
        ) {
          const result = (
            cell.value as { result?: string | number | boolean | null }
          ).result;
          rawValue = result ?? "";
        } else {
          rawValue = (cell.value as string | number | boolean | null) ?? "";
        }

        const isNumber = typeof rawValue === "number";
        const isDate = cell.value instanceof Date;

        const cellValue: FortuneSheetCell["v"] = {
          v: rawValue as string | number | boolean | null,
          m: cell.text || String(rawValue),
          ct: {
            fa: (cell.numFmt as string) || "General",
            t: isNumber ? "n" : isDate ? "d" : "g",
          },
        };

        // Style mapping
        const font = cell.font;
        if (font) {
          if (font.bold) cellValue.bl = 1;
          if (font.italic) cellValue.it = 1;
          if (font.size) cellValue.fs = font.size;
          if (font.color?.argb) cellValue.fc = `#${font.color.argb.slice(2)}`;
        }

        const fill = cell.fill;
        if (fill && fill.type === "pattern" && fill.fgColor?.argb) {
          cellValue.bg = `#${fill.fgColor.argb.slice(2)}`;
        }

        const alignment = cell.alignment;
        if (alignment) {
          if (alignment.horizontal === "center") cellValue.ht = 0;
          else if (alignment.horizontal === "right") cellValue.ht = 2;
          if (alignment.vertical === "middle") cellValue.vt = 0;
          else if (alignment.vertical === "top") cellValue.vt = 1;
        }

        // Tag merged cell origin
        const mergeInfo = mergeMap.get(`${r},${c}`);
        if (mergeInfo) {
          cellValue.mc = mergeInfo;
        }

        celldata.push({ r, c, v: cellValue });
      });
    });

    const rowCount = Math.max(maxRow + 1, 50);
    const colCount = Math.max(maxCol + 1, 26);

    return {
      name: ws.name,
      celldata,
      order: idx,
      row: rowCount,
      column: colCount,
      config: {
        ...(Object.keys(columnWidths).length > 0
          ? { columnlen: columnWidths }
          : {}),
        ...(Object.keys(rowHeights).length > 0 ? { rowlen: rowHeights } : {}),
        ...(merges.length > 0
          ? {
              merge: Object.fromEntries(
                merges.map((m) => [`${m.r}_${m.c}`, m])
              ),
            }
          : {}),
      },
    };
  });
}
