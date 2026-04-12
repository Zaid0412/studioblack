"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Loader2, FileText } from "lucide-react";
import "@fortune-sheet/react/dist/index.css";

const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((mod) => mod.Workbook),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Fortune Sheet types don't align with local interfaces
) as React.ComponentType<any>;

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
    mc?: { r: number; c: number; rs: number; cs: number };
  };
}

interface FortuneSheetData {
  name: string;
  celldata: FortuneSheetCell[];
  order: number;
  row?: number;
  column?: number;
  config?: Record<string, unknown>;
  frozen?: {
    type: string;
    range?: { row_focus: number; column_focus: number };
  };
}

interface SpreadsheetViewerProps {
  fileUrl: string;
  fileName: string;
  children?: ReactNode;
}

/**
 * Renders Excel/CSV files using Fortune Sheet for faithful Excel-like rendering.
 * Supports formatting, merged cells, column widths, and multiple sheets.
 */
export function SpreadsheetViewer({
  fileUrl,
  children,
}: SpreadsheetViewerProps) {
  const [sheetData, setSheetData] = useState<FortuneSheetData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch and parse the Excel file
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const ExcelJS = await import("exceljs");

        const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Failed to fetch file");
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);

        const sheets: FortuneSheetData[] = workbook.worksheets.map(
          (ws, idx) => {
            const celldata: FortuneSheetCell[] = [];
            const merges: { r: number; c: number; rs: number; cs: number }[] =
              [];

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

            // Parse column widths
            const columnWidths: Record<string, number> = {};
            ws.columns.forEach((col, i) => {
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
                  rawValue =
                    (cell.value as string | number | boolean | null) ?? "";
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
                  if (font.color?.argb)
                    cellValue.fc = `#${font.color.argb.slice(2)}`;
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
                ...(Object.keys(rowHeights).length > 0
                  ? { rowlen: rowHeights }
                  : {}),
                ...(merges.length > 0
                  ? {
                      merge: Object.fromEntries(
                        merges.map((m) => [`${m.r}_${m.c}`, m])
                      ),
                    }
                  : {}),
              },
            };
          }
        );

        if (!cancelled) setSheetData(sheets);
      } catch (err) {
        console.error("[SpreadsheetViewer] Load error:", err);
        if (!cancelled) setError("Failed to load spreadsheet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#F5C518]" />
      </div>
    );
  }

  if (error || !sheetData || sheetData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <FileText className="w-12 h-12 text-text-muted" />
        <p className="text-text-secondary text-sm">
          {error || "No data found in spreadsheet."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Workbook
        data={sheetData}
        onChange={() => {}}
        showToolbar={false}
        showFormulaBar={false}
        showSheetTabs={sheetData.length > 1}
        allowEdit={false}
        cellContextMenu={[]}
      />
      {children}
    </div>
  );
}
