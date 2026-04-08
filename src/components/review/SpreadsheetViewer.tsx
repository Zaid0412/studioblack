"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { Loader2, FileText, Save, Check } from "lucide-react";
import { fortuneSheetToXlsx } from "@/lib/spreadsheetUtils";
import { getFileExtension } from "@/lib/fileUtils";
import "@fortune-sheet/react/dist/index.css";

const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((mod) => mod.Workbook),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  canEdit?: boolean;
  onSave?: (blob: Blob, newFileName: string) => Promise<void>;
  children?: ReactNode;
}

/** Extract cell values from Fortune Sheet data for stable comparison. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCellValues(data: any): string {
  if (!Array.isArray(data)) return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((sheet: any) => {
    // Fortune Sheet internal format: 2D array
    if (sheet?.data && Array.isArray(sheet.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return sheet.data.map((row: any) => {
        if (!Array.isArray(row)) return "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return row.map((cell: any) => {
          if (!cell) return "";
          return cell.v ?? cell.m ?? "";
        }).join("|");
      }).join("\n");
    }
    // Original celldata format: sparse array of {r, c, v}
    if (sheet?.celldata && Array.isArray(sheet.celldata)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return sheet.celldata.map((cell: any) => {
        if (!cell?.v) return "";
        return `${cell.r},${cell.c}:${cell.v.v ?? cell.v.m ?? ""}`;
      }).join("|");
    }
    return "";
  }).join("|||");
}

/**
 * Renders Excel/CSV files using Fortune Sheet.
 * When canEdit=true, enables editing and shows a "Save as New Version" button.
 */
export function SpreadsheetViewer({
  fileUrl,
  fileName,
  canEdit = false,
  onSave,
  children,
}: SpreadsheetViewerProps) {
  const [sheetData, setSheetData] = useState<FortuneSheetData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Track latest sheet data via ref to avoid re-renders on every keystroke
  const latestDataRef = useRef<FortuneSheetData[] | null>(null);
  // Snapshot of initial data (JSON string) — used to detect real changes
  const initialSnapshotRef = useRef<string | null>(null);
  // Debounce timer for locking the snapshot after onChange stops firing
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether committed (Enter'd) changes exist, separate from in-progress typing
  const committedDirtyRef = useRef(false);
  // The cell value when editing started (before user types anything)
  const preEditValueRef = useRef<string>("");

  // Fetch and parse the Excel file
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setDirty(false);
      initialSnapshotRef.current = null;
      committedDirtyRef.current = false;
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
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

            const mergeMap = new Map<
              string,
              { r: number; c: number; rs: number; cs: number }
            >();
            for (const m of merges) {
              mergeMap.set(`${m.r},${m.c}`, m);
            }

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

              if (cell.s) {
                if (cell.s.font?.bold) cellValue.bl = 1;
                if (cell.s.font?.italic) cellValue.it = 1;
                if (cell.s.font?.sz) cellValue.fs = cell.s.font.sz;
                if (cell.s.font?.color?.rgb)
                  cellValue.fc = `#${cell.s.font.color.rgb}`;
                if (cell.s.fill?.fgColor?.rgb)
                  cellValue.bg = `#${cell.s.fill.fgColor.rgb}`;
                if (cell.s.alignment?.horizontal === "center") cellValue.ht = 0;
                else if (cell.s.alignment?.horizontal === "right")
                  cellValue.ht = 2;
                if (cell.s.alignment?.vertical === "center") cellValue.vt = 0;
                else if (cell.s.alignment?.vertical === "top") cellValue.vt = 1;
              }

              const mergeInfo = mergeMap.get(`${decoded.r},${decoded.c}`);
              if (mergeInfo) {
                cellValue.mc = mergeInfo;
              }

              celldata.push({ r: decoded.r, c: decoded.c, v: cellValue });
            }

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

        if (!cancelled) {
          setSheetData(sheets);
          latestDataRef.current = sheets;
        }
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

  // Real-time dirty tracking while typing in Fortune Sheet's cell editor
  useEffect(() => {
    if (!canEdit) return;

    function isFortuneSheetEditor(el: HTMLElement) {
      return !!el.closest(".luckysheet-input-box");
    }

    // Capture the cell's original value when editing begins
    function onFocus(e: Event) {
      const target = e.target as HTMLElement;
      if (!isFortuneSheetEditor(target)) return;
      preEditValueRef.current = (target as HTMLTextAreaElement).value ?? "";
    }

    // Compare live textarea value to pre-edit value on each keystroke
    function onInput(e: Event) {
      if (!initialSnapshotRef.current) return;
      const target = e.target as HTMLElement;
      if (!isFortuneSheetEditor(target)) return;
      const currentVal = (target as HTMLTextAreaElement).value ?? "";
      const cellChanged = currentVal !== preEditValueRef.current;
      setDirty(cellChanged || committedDirtyRef.current);
    }

    document.addEventListener("focus", onFocus, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("focus", onFocus, true);
      document.removeEventListener("input", onInput, true);
    };
  }, [canEdit]);


  // Track committed changes — compare cell values against snapshot
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      latestDataRef.current = data;
      const values = extractCellValues(data);

      // Snapshot not locked yet — debounce until onChange stops for 1s
      if (!initialSnapshotRef.current) {
        if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = setTimeout(() => {
          initialSnapshotRef.current = values;
        }, 1000);
        return;
      }

      const hasChanges = values !== initialSnapshotRef.current;
      committedDirtyRef.current = hasChanges;
      setDirty(hasChanges);
    },
    []
  );

  // Save as new version
  const handleSave = useCallback(async () => {
    if (!onSave || !latestDataRef.current || saving) return;
    setSaving(true);
    try {
      const arrayBuffer = await fortuneSheetToXlsx(latestDataRef.current);
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // If original was CSV, upgrade to xlsx
      const ext = getFileExtension(fileName);
      const newFileName =
        ext === "csv" ? fileName.replace(/\.csv$/i, ".xlsx") : fileName;

      await onSave(blob, newFileName);
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("[SpreadsheetViewer] Save error:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave, saving, fileName]);

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    if (!canEdit || !onSave) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canEdit, onSave, handleSave]);

  // Unsaved changes warning
  useEffect(() => {
    if (!dirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

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
        onChange={canEdit ? handleChange : () => {}}
        showToolbar={canEdit}
        showFormulaBar={canEdit}
        showSheetTabs={sheetData.length > 1}
        allowEdit={canEdit}
        cellContextMenu={canEdit ? undefined : []}
      />

      {/* Floating save button — always mounted when canEdit, animated via opacity/translate */}
      {canEdit && onSave && (
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg bg-[#F5C518] text-[#0D0D0D] px-4 py-2.5 text-sm font-semibold shadow-lg hover:bg-[#F5C518]/90 transition-all duration-200 ease-out cursor-pointer ${
            dirty
              ? saving ? "opacity-60" : "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save as New Version
            </>
          )}
        </button>
      )}

      {children}
    </div>
  );
}
