"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText } from "lucide-react";

interface SpreadsheetViewerProps {
  fileUrl: string;
  fileName: string;
}

/**
 * Renders Excel/CSV files as HTML tables using SheetJS (xlsx).
 * Supports multiple sheets via tabs.
 */
export function SpreadsheetViewer({
  fileUrl,
  fileName,
}: SpreadsheetViewerProps) {
  const [sheets, setSheets] = useState<
    { name: string; html: string }[]
  >([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const XLSX = await import("xlsx");

        // Fetch the file as an ArrayBuffer (via proxy to avoid CORS)
        const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Failed to fetch file");
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const workbook = XLSX.read(data, { type: "array" });

        const parsed = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const html = XLSX.utils.sheet_to_html(sheet, { id: "sjs-table" });
          return { name, html };
        });

        setSheets(parsed);
        setActiveSheet(0);
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

  if (error || sheets.length === 0) {
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
    <div className="flex flex-col h-full">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border-default bg-bg-primary overflow-x-auto shrink-0">
          {sheets.map((sheet, idx) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(idx)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                idx === activeSheet
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table content */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="spreadsheet-table"
          dangerouslySetInnerHTML={{ __html: sheets[activeSheet].html }}
        />
      </div>
    </div>
  );
}
