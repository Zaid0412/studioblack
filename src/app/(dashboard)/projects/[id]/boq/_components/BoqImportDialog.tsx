"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/useToast";
import { cn } from "@/lib/utils";
import { boq as boqApi, ApiError } from "@/lib/api";
import {
  BOQ_IMPORT_MAX_BYTES,
  type BoqImportStrategy,
} from "@/lib/validations";
import { BOQ_TEMPLATE_COLUMN_LABELS } from "@/lib/excel/boqParser";
import type { BoqImportPreview } from "@/lib/api/boq";
import type { BulkBoqImportResult } from "@/types";

type Step = "upload" | "preview" | "strategy" | "confirming" | "result";

const PREVIEW_COLUMNS = [
  { key: "itemCode", label: "Code" },
  { key: "description", label: "Description" },
  { key: "unit", label: "Unit" },
  { key: "quantity", label: "Qty" },
  { key: "unitCost", label: "Unit Cost" },
] as const;

interface BoqImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImported: () => void;
}

/**
 * Multi-step dialog: upload → preview → strategy → confirming → result.
 * Scope is narrower than F3's ImportDialog — no row-level selection, and
 * only two strategies (append/replace).
 */
export function BoqImportDialog({
  open,
  onOpenChange,
  projectId,
  onImported,
}: BoqImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState<BoqImportPreview | null>(null);
  const [strategy, setStrategy] = useState<BoqImportStrategy>("append");
  const [result, setResult] = useState<BulkBoqImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Replace the in-flight controller, aborting any prior one. Without this
   * the user can fire `runPreview` and then click "Continue" → "Import items"
   * fast enough that `runConfirm` overwrites `abortRef.current` while the
   * preview is still pending — the preview controller leaks (no longer
   * abortable) and its late `setPreview` may land on a reset dialog.
   */
  const replaceController = useCallback((next: AbortController) => {
    abortRef.current?.abort();
    abortRef.current = next;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setStrategy("append");
    setValidating(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const validCount = useMemo(
    () => preview?.rows.filter((r) => r.status === "valid").length ?? 0,
    [preview]
  );
  const errorCount = useMemo(
    () => preview?.rows.filter((r) => r.status === "error").length ?? 0,
    [preview]
  );
  const warningCount = useMemo(
    () =>
      preview?.rows.reduce((n, r) => n + (r.warnings?.length ? 1 : 0), 0) ?? 0,
    [preview]
  );

  const canProceedToStrategy =
    preview !== null &&
    preview.missingColumns.length === 0 &&
    validCount > 0 &&
    errorCount === 0;

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast({
        title: "Unsupported file",
        description: "Upload an .xlsx spreadsheet.",
        variant: "error",
      });
      return;
    }
    if (f.size > BOQ_IMPORT_MAX_BYTES) {
      toast({
        title: "File too large",
        description: `Maximum ${BOQ_IMPORT_MAX_BYTES / 1024 / 1024}MB.`,
        variant: "error",
      });
      return;
    }
    setFile(f);
  }, []);

  const runPreview = useCallback(async () => {
    if (!file) return;
    setValidating(true);
    const controller = new AbortController();
    replaceController(controller);
    try {
      const res = await boqApi.validateImport(
        projectId,
        file,
        controller.signal
      );
      setPreview(res);
      setStep("preview");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not read file";
      toast({ title: "Import failed", description: message, variant: "error" });
    } finally {
      setValidating(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [file, projectId, replaceController]);

  const runConfirm = useCallback(async () => {
    if (!preview) return;
    setStep("confirming");
    const rows = preview.rows
      .filter((r) => r.status === "valid" && r.parsed !== null)
      .map((r) => r.parsed!);
    const controller = new AbortController();
    replaceController(controller);
    try {
      const res = await boqApi.confirmImport(
        projectId,
        { boqId: preview.boqId, strategy, rows },
        controller.signal
      );
      setResult(res);
      setStep("result");
      // `bulkInsertBoqItems` is all-or-nothing today — a per-row failure
      // throws `ImportRowError` and rolls back the transaction, so any
      // non-empty `failed[]` arrives with `rolledBack: true`. If a future
      // strategy ships partial success, branch here.
      if (res.failed.length === 0) {
        toast({
          title: "Import complete",
          description: `${res.inserted} item${res.inserted === 1 ? "" : "s"} added${res.replaced > 0 ? ` (${res.replaced} replaced)` : ""}.`,
          variant: "success",
        });
        onImported();
      } else {
        toast({
          title: "Import rolled back",
          description: `Row ${res.failed[0]?.rowNumber} failed — nothing was imported.`,
          variant: "warning",
        });
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import failed";
      toast({ title: "Import failed", description: message, variant: "error" });
      setStep("strategy");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [preview, projectId, strategy, onImported, replaceController]);

  /**
   * Guard the close path. Two failure modes if we just delegate to
   * `onOpenChange`:
   *   - ESC / overlay-click while `step === "confirming"` aborts the fetch,
   *     but the server-side COMMIT already happened. The dialog never sees
   *     the response and `onImported` is never called → user sees stale data.
   *   - Closing from `result` via the X / overlay (instead of "Done")
   *     skips the callback that refreshes the parent BOQ table.
   */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (step === "confirming") return;
      if (!next && step === "result" && result && result.failed.length === 0) {
        onImported();
      }
      onOpenChange(next);
    },
    [onOpenChange, onImported, step, result]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import BOQ from Excel</DialogTitle>
          <DialogDescription>
            Upload an .xlsx file matching the BOQ template.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFile(dropped);
              }}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                dragOver
                  ? "border-accent bg-accent/10"
                  : "border-border-default hover:border-accent/50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-10 w-10 mx-auto text-text-muted mb-3" />
              <p className="text-sm font-medium text-text-primary">
                Drag an .xlsx here or click to browse
              </p>
              <p className="text-xs text-text-muted mt-1">
                Max {BOQ_IMPORT_MAX_BYTES / 1024 / 1024}MB · Required columns:
                Description, Unit, Quantity, Unit Cost
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) handleFile(picked);
                  e.target.value = "";
                }}
              />
            </div>

            {file && (
              <div className="flex items-center justify-between bg-bg-elevated rounded-md px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-text-muted shrink-0">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={runPreview} disabled={!file || validating}>
                {validating && <Loader2 className="h-4 w-4 animate-spin" />}
                {validating ? "Parsing…" : "Preview"}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <PreviewSummary
              total={preview.totalRows}
              valid={validCount}
              errors={errorCount}
              warnings={warningCount}
              missingColumns={preview.missingColumns}
              unknownColumns={preview.unknownColumns}
              truncated={preview.truncated}
            />

            {preview.rows.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-secondary text-xs uppercase tracking-wide">
                        <th className="sticky top-0 z-10 bg-bg-elevated text-left px-3 py-2 w-10 border-b border-border-default">
                          #
                        </th>
                        <th className="sticky top-0 z-10 bg-bg-elevated text-left px-3 py-2 border-b border-border-default">
                          Status
                        </th>
                        {PREVIEW_COLUMNS.map((c) => (
                          <th
                            key={c.key}
                            className="sticky top-0 z-10 bg-bg-elevated text-left px-3 py-2 border-b border-border-default"
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => {
                        const parsed = row.parsed;
                        return (
                          <tr
                            key={row.rowNumber}
                            className={cn(
                              "border-t",
                              row.status === "error" && "bg-error/5"
                            )}
                          >
                            <td className="px-3 py-2 text-text-muted">
                              {row.excelRowNumber}
                            </td>
                            <td className="px-3 py-2">
                              {row.status === "valid" ? (
                                row.linkedElement ? (
                                  <Badge variant="info">
                                    <Link2 className="h-3 w-3" />
                                    Linked
                                  </Badge>
                                ) : (
                                  <Badge variant="success">Valid</Badge>
                                )
                              ) : (
                                <Badge variant="error">Error</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {parsed?.itemCode ?? "(auto)"}
                            </td>
                            <td className="px-3 py-2 truncate max-w-xs">
                              {parsed?.description ??
                                String(row.raw["Description"] ?? "")}
                            </td>
                            <td className="px-3 py-2">{parsed?.unit ?? ""}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {parsed?.quantity ?? ""}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {parsed?.unitCost ?? ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {errorCount > 0 && <RowIssues rows={preview.rows} kind="error" />}
            {warningCount > 0 && (
              <RowIssues rows={preview.rows} kind="warning" />
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("strategy")}
                disabled={!canProceedToStrategy}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "strategy" && preview && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <p className="text-sm text-text-secondary">
              {validCount} item{validCount === 1 ? "" : "s"} ready to import.
              Choose how to apply them:
            </p>

            <StrategyOption
              selected={strategy === "append"}
              onSelect={() => setStrategy("append")}
              title="Append"
              description="Keep existing BOQ items; add the imported rows after them."
            />
            <StrategyOption
              selected={strategy === "replace"}
              onSelect={() => setStrategy("replace")}
              title="Replace all items"
              description="Delete every item currently in the BOQ, then insert the imported rows. Sections are kept. This can't be undone."
              destructive
            />

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button
                onClick={runConfirm}
                variant={strategy === "replace" ? "danger" : "primary"}
              >
                {strategy === "replace" ? "Replace and import" : "Import items"}
              </Button>
            </div>
          </div>
        )}

        {step === "confirming" && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-sm text-text-secondary">
              <Loader2 className="h-6 w-6 animate-spin" />
              Applying import…
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center gap-3 border rounded-md p-4">
              {result.failed.length === 0 ? (
                <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
              )}
              <div>
                <p className="font-medium text-text-primary">
                  {result.failed.length === 0
                    ? "Import complete"
                    : "Import rolled back"}
                </p>
                <p className="text-sm text-text-secondary">
                  {result.failed.length === 0 ? (
                    <>
                      {result.inserted} inserted
                      {result.replaced > 0 && ` · ${result.replaced} replaced`}
                      {result.createdSections.length > 0 &&
                        ` · ${result.createdSections.length} new section${result.createdSections.length === 1 ? "" : "s"}`}
                    </>
                  ) : (
                    `Row ${result.failed[0]?.rowNumber} failed — no items were imported and any prior items in this BOQ are unchanged.`
                  )}
                </p>
              </div>
            </div>

            {result.failed.length > 0 && (
              <ul className="border rounded-md divide-y">
                {result.failed.map((f) => (
                  <li key={f.rowNumber} className="p-3 text-sm">
                    <span className="font-medium">Row {f.rowNumber}:</span>{" "}
                    <span className="text-text-secondary">{f.error}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewSummary({
  total,
  valid,
  errors,
  warnings,
  missingColumns,
  unknownColumns,
  truncated,
}: {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  missingColumns: string[];
  unknownColumns: string[];
  truncated?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <span>
          <span className="text-text-muted">Total:</span>{" "}
          <span className="font-medium">{total}</span>
        </span>
        <span className="text-success">
          <span className="text-text-muted">Valid:</span>{" "}
          <span className="font-medium">{valid}</span>
        </span>
        {errors > 0 && (
          <span className="text-error">
            <span className="text-text-muted">Errors:</span>{" "}
            <span className="font-medium">{errors}</span>
          </span>
        )}
        {warnings > 0 && (
          <span className="text-warning">
            <span className="text-text-muted">Warnings:</span>{" "}
            <span className="font-medium">{warnings}</span>
          </span>
        )}
      </div>

      {missingColumns.length > 0 && (
        <div className="border border-error/40 bg-error/5 rounded-md p-3 text-sm">
          <p className="font-medium text-error">Missing required columns</p>
          <p className="text-text-secondary">
            {missingColumns.join(", ")}. Add them to the sheet and re-upload.
          </p>
        </div>
      )}

      {unknownColumns.length > 0 && (
        <div className="text-xs text-text-muted">
          Ignored unknown columns: {unknownColumns.join(", ")}. Expected any of:{" "}
          {Object.values(BOQ_TEMPLATE_COLUMN_LABELS).join(", ")}.
        </div>
      )}

      {truncated && (
        <div className="border border-warning/40 bg-warning/5 rounded-md p-3 text-sm text-warning">
          Sheet was truncated — only the first 5,000 rows were read.
        </div>
      )}
    </div>
  );
}

function RowIssues({
  rows,
  kind,
}: {
  rows: BoqImportPreview["rows"];
  kind: "error" | "warning";
}) {
  const items = rows.flatMap((row) => {
    const list = kind === "error" ? row.errors : row.warnings;
    return list.map((msg) => ({
      rowNumber: row.excelRowNumber,
      msg,
    }));
  });
  if (items.length === 0) return null;
  const color =
    kind === "error"
      ? "border-error/40 bg-error/5 text-error"
      : "border-warning/40 bg-warning/5 text-warning";
  return (
    <div className={cn("border rounded-md p-3 text-sm", color)}>
      <p className="font-medium mb-1">
        {kind === "error" ? "Errors" : "Warnings"}
      </p>
      <ul className="list-disc list-inside space-y-1 text-text-secondary">
        {items.slice(0, 20).map((it, i) => (
          <li key={i}>
            <span className="font-medium">Row {it.rowNumber}:</span> {it.msg}
          </li>
        ))}
        {items.length > 20 && (
          <li className="italic">…and {items.length - 20} more</li>
        )}
      </ul>
    </div>
  );
}

function StrategyOption({
  selected,
  onSelect,
  title,
  description,
  destructive,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border rounded-md p-4 text-left transition-colors",
        selected
          ? destructive
            ? "border-error bg-error/5"
            : "border-accent bg-accent/10"
          : "border-border-default hover:bg-bg-elevated"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0",
            selected
              ? destructive
                ? "border-error bg-error"
                : "border-accent bg-accent"
              : "border-border-default"
          )}
        />
        <div>
          <p className="font-medium text-text-primary">{title}</p>
          <p className="text-sm text-text-secondary mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}
