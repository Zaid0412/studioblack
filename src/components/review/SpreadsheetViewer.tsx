"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Loader2, FileText } from "lucide-react";
import "@fortune-sheet/react/dist/index.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((mod) => mod.Workbook),
  { ssr: false }
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
  fileName,
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
        const XLSX = await import("xlsx");

        const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Failed to fetch file");
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const workbook = XLSX.read(data, {
          type: "array",
          cellStyles: true,
          cellDates: true,
        });

        const sheets: FortuneSheetData[] = workbook.SheetNames.map(
          (name, idx) => {
            const ws = workbook.Sheets[name];
            const celldata: FortuneSheetCell[] = [];
            const merges: { r: number; c: number; rs: number; cs: number }[] =
              [];

            // Parse merged cells
            if (ws["!merges"]) {
              for (const merge of ws["!merges"]) {
                merges.push({
                  r: merge.s.r,
                  c: merge.s.c,
                  rs: merge.e.r - merge.s.r + 1,
                  cs: merge.e.c - merge.s.c + 1,
                });
              }
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
            if (ws["!cols"]) {
              ws["!cols"].forEach(
                (
                  col: { wpx?: number; wch?: number } | undefined,
                  i: number
                ) => {
                  if (col?.wpx) columnWidths[String(i)] = col.wpx;
                  else if (col?.wch) columnWidths[String(i)] = col.wch * 8;
                }
              );
            }

            // Parse row heights
            const rowHeights: Record<string, number> = {};
            if (ws["!rows"]) {
              ws["!rows"].forEach(
                (
                  row: { hpx?: number; hpt?: number } | undefined,
                  i: number
                ) => {
                  if (row?.hpx) rowHeights[String(i)] = row.hpx;
                  else if (row?.hpt) rowHeights[String(i)] = row.hpt * 1.333;
                }
              );
            }

            // Parse cells
            for (const addr in ws) {
              if (addr.startsWith("!")) continue;
              const cell = ws[addr];
              const decoded = XLSX.utils.decode_cell(addr);

              const cellValue: FortuneSheetCell["v"] = {
                v: cell.v ?? "",
                m: cell.w ?? String(cell.v ?? ""),
                ct: {
                  fa: cell.z || "General",
                  t: cell.t === "n" ? "n" : cell.t === "d" ? "d" : "g",
                },
              };

              // Basic style mapping from SheetJS cell style
              if (cell.s) {
                if (cell.s.font?.bold) cellValue.bl = 1;
                if (cell.s.font?.italic) cellValue.it = 1;
                if (cell.s.font?.sz) cellValue.fs = cell.s.font.sz;
                if (cell.s.font?.color?.rgb)
                  cellValue.fc = `#${cell.s.font.color.rgb}`;
                if (cell.s.fill?.fgColor?.rgb)
                  cellValue.bg = `#${cell.s.fill.fgColor.rgb}`;
                // Horizontal alignment
                if (cell.s.alignment?.horizontal === "center") cellValue.ht = 0;
                else if (cell.s.alignment?.horizontal === "right")
                  cellValue.ht = 2;
                // Vertical alignment
                if (cell.s.alignment?.vertical === "center") cellValue.vt = 0;
                else if (cell.s.alignment?.vertical === "top") cellValue.vt = 1;
              }

              // Tag merged cell origin
              const mergeInfo = mergeMap.get(`${decoded.r},${decoded.c}`);
              if (mergeInfo) {
                cellValue.mc = mergeInfo;
              }

              celldata.push({ r: decoded.r, c: decoded.c, v: cellValue });
            }

            // Determine grid size from range
            const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
            const rowCount = Math.max(range.e.r + 1, 50);
            const colCount = Math.max(range.e.c + 1, 26);

            return {
              name,
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
  }, [fileUrl, fileName]);

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
