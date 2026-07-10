import * as ExcelJS from "exceljs";
import type { FortuneSheetCell, FortuneSheetData } from "./spreadsheet-types";

/**
 * Split CSV text into rows of fields (RFC-4180-ish: handles quoted fields with
 * embedded commas / newlines and escaped `""` quotes).
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  // Trailing field/row when the file doesn't end in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Build a single Fortune Sheet from CSV rows (no styles; numbers typed). */
function csvToSheet(rows: string[][]): FortuneSheetData {
  const celldata: FortuneSheetCell[] = [];
  let maxRow = 0;
  let maxCol = 0;
  rows.forEach((cols, r) => {
    cols.forEach((raw, c) => {
      if (raw === "") return; // match xlsx's includeEmpty:false
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
      const num = Number(raw);
      const isNum = raw.trim() !== "" && !Number.isNaN(num);
      celldata.push({
        r,
        c,
        v: {
          v: isNum ? num : raw,
          m: raw, // preserve the literal text (e.g. leading-zero codes)
          ct: { fa: "General", t: isNum ? "n" : "g" },
        },
      });
    });
  });
  return {
    name: "Sheet1",
    celldata,
    order: 0,
    row: Math.max(maxRow + 1, 50),
    column: Math.max(maxCol + 1, 26),
    config: {},
  };
}

/**
 * Parse + normalize a spreadsheet buffer into Fortune Sheet data.
 *
 * Dispatches on content: `.xlsx`/`.xlsm` are zip files (magic `PK\x03\x04`) and
 * go through exceljs; anything else is decoded as CSV text (exceljs's
 * `xlsx.load` only reads the zip format, so a CSV threw "not a zip file"). Pure
 * (no DOM) so it runs in the parse worker (`spreadsheet.worker.ts`) and is
 * directly unit-testable. Output shape must stay identical to what `<Workbook>`
 * consumes — see `spreadsheet-parse.test.ts`.
 */
export async function parseWorkbookToSheets(
  buffer: ArrayBuffer
): Promise<FortuneSheetData[]> {
  const head = new Uint8Array(buffer.slice(0, 4));
  const isZip =
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    head[2] === 0x03 &&
    head[3] === 0x04;
  if (!isZip) {
    return [csvToSheet(parseCsvText(new TextDecoder().decode(buffer)))];
  }

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
