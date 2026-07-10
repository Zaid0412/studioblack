"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  FortuneSheetData,
  SpreadsheetWorkerResult,
} from "./spreadsheet-types";
import "@fortune-sheet/react/dist/index.css";

const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((mod) => mod.Workbook),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Fortune Sheet types don't align with local interfaces
) as React.ComponentType<any>;

interface SpreadsheetViewerProps {
  fileUrl: string;
  fileName: string;
  children?: ReactNode;
}

/**
 * Renders Excel/CSV files using Fortune Sheet for faithful Excel-like rendering.
 * Supports formatting, merged cells, column widths, and multiple sheets.
 *
 * The workbook parse/normalize runs in a web worker (`spreadsheet.worker.ts`)
 * so a large file doesn't block the main thread — the tab stays interactive
 * and the loading skeleton keeps animating during parse.
 */
export function SpreadsheetViewer({
  fileUrl,
  children,
}: SpreadsheetViewerProps) {
  const [sheetData, setSheetData] = useState<FortuneSheetData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the file on the main thread, then hand the buffer to a worker that
  // does the (heavy, synchronous) exceljs parse + normalize off-thread.
  useEffect(() => {
    let cancelled = false;
    const worker = new Worker(
      new URL("./spreadsheet.worker.ts", import.meta.url)
    );

    worker.onmessage = (e: MessageEvent<SpreadsheetWorkerResult>) => {
      if (cancelled) return;
      if (e.data.ok) {
        setSheetData(e.data.sheets);
      } else {
        console.error("[SpreadsheetViewer] Parse error:", e.data.error);
        setError("Failed to load spreadsheet.");
      }
      setLoading(false);
    };
    worker.onerror = (e) => {
      if (cancelled) return;
      console.error("[SpreadsheetViewer] Worker error:", e.message);
      setError("Failed to load spreadsheet.");
      setLoading(false);
    };

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Failed to fetch file");
        const data = await res.arrayBuffer();
        if (cancelled) return;
        // Transfer the buffer (detaches it here) to avoid a copy.
        worker.postMessage(data, [data]);
      } catch (err) {
        console.error("[SpreadsheetViewer] Load error:", err);
        if (!cancelled) {
          setError("Failed to load spreadsheet.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [fileUrl]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header row */}
        <div className="flex items-center gap-px border-b border-border-default">
          <Skeleton className="w-10 h-8 rounded-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-8 rounded-none" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-px border-b border-border-default/50"
          >
            <Skeleton className="w-10 h-7 rounded-none" />
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton key={j} className="flex-1 h-7 rounded-none" />
            ))}
          </div>
        ))}
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
