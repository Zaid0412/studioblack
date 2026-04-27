"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/useToast";
import { elements as elementsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DUPLICATE_STRATEGIES,
  ELEMENT_IMPORT_MAX_BYTES,
  type DuplicateStrategy,
} from "@/lib/validations";
import {
  TEMPLATE_COLUMN_LABELS,
  type ParseResult,
  type ParsedElementRow,
} from "@/lib/excel/elementParser";
import type { ImportConfirmResult } from "@/lib/api/elements";

type Step = "upload" | "preview" | "strategy" | "confirming" | "result";

const PREVIEW_COLUMNS: ReadonlyArray<{
  key: keyof typeof TEMPLATE_COLUMN_LABELS;
  labelKey: "colCode" | "colName" | "colUnit" | "colUnitCost";
  className?: string;
}> = [
  { key: "code", labelKey: "colCode" },
  { key: "name", labelKey: "colName" },
  { key: "unit", labelKey: "colUnit" },
  { key: "unitCost", labelKey: "colUnitCost", className: "w-24 text-right" },
];

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** Multi-step dialog: upload → preview → strategy → confirm → result. */
export function ImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportDialogProps) {
  const t = useTranslations("elements");

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [strategy, setStrategy] = useState<DuplicateStrategy>("skip");
  const [result, setResult] = useState<ImportConfirmResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Abort the in-flight validate/confirm when the dialog closes or the user
  // re-triggers the flow, so stale resolves don't mutate state.
  const abortRef = useRef<AbortController | null>(null);
  // Guard against double-clicks on Confirm: step flips asynchronously so a
  // second synchronous click can fire a duplicate request.
  const confirmInFlightRef = useRef(false);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    abortInFlight();
    confirmInFlightRef.current = false;
    setStep("upload");
    setFile(null);
    setDragOver(false);
    setValidating(false);
    setParse(null);
    setSelected(new Set());
    setStrategy("skip");
    setResult(null);
  }, [abortInFlight]);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (step === "confirming") return;
      // Closing from the result step still counts as a successful import —
      // refresh the caller's list even on ESC / overlay / X.
      if (!next && step === "result") onSuccess();
      onOpenChange(next);
    },
    [onOpenChange, onSuccess, step]
  );

  // ── Upload step ──────────────────────────────────────────────────────────

  const runValidate = useCallback(
    async (f: File) => {
      if (f.size > ELEMENT_IMPORT_MAX_BYTES) {
        toast({
          title: t("importFailed"),
          description: t("importTooLarge"),
          variant: "error",
        });
        return;
      }
      abortInFlight();
      const controller = new AbortController();
      abortRef.current = controller;
      setFile(f);
      setValidating(true);
      try {
        const res = await elementsApi.validateImport(f, controller.signal);
        if (controller.signal.aborted) return;
        setParse(res);
        // Pre-check all valid rows by default.
        const valid = res.rows
          .filter((r) => r.status === "valid")
          .map((r) => r.rowNumber);
        setSelected(new Set(valid));
        setStep("preview");
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : t("importFailed");
        toast({ title: t("importFailed"), description: msg, variant: "error" });
        setFile(null);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (!controller.signal.aborted) setValidating(false);
      }
    },
    [abortInFlight, t]
  );

  const handleFileChosen = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      if (list.length > 1) {
        toast({
          title: t("importMultipleFiles"),
          variant: "default",
        });
      }
      void runValidate(list[0]);
    },
    [runValidate, t]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropzoneKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker]
  );

  // ── Preview helpers ──────────────────────────────────────────────────────

  const validRows = useMemo(
    () => (parse?.rows ?? []).filter((r) => r.status === "valid"),
    [parse]
  );
  const errorRows = useMemo(
    () => (parse?.rows ?? []).filter((r) => r.status === "error"),
    [parse]
  );
  const missingColumns = parse?.missingColumns ?? [];
  const hasFatal = missingColumns.length > 0;

  const toggleRow = (rowNumber: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === validRows.length) setSelected(new Set());
    else setSelected(new Set(validRows.map((r) => r.rowNumber)));
  };

  // ── Confirm ──────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!parse) return;
    if (confirmInFlightRef.current) return;
    const rowsToSend = validRows
      .filter((r) => selected.has(r.rowNumber))
      .map((r) => r.parsed!);
    if (rowsToSend.length === 0) return;
    confirmInFlightRef.current = true;
    abortInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep("confirming");
    try {
      const res = await elementsApi.confirmImport(
        { strategy, rows: rowsToSend },
        controller.signal
      );
      if (controller.signal.aborted) return;
      setResult(res);
      setStep("result");
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : t("importFailed");
      toast({ title: t("importFailed"), description: msg, variant: "error" });
      setStep("strategy");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      confirmInFlightRef.current = false;
    }
  }, [abortInFlight, parse, selected, strategy, t, validRows]);

  const handleDone = useCallback(() => {
    onSuccess();
    onOpenChange(false);
  }, [onOpenChange, onSuccess]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const selectedCount = selected.size;
  const confirmDisabled = selectedCount === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{t("importTitle")}</DialogTitle>
          <DialogDescription>{t("importSubtitle")}</DialogDescription>
        </DialogHeader>

        {/* ── Step: Upload ──────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="flex flex-col gap-4">
            <div
              role="button"
              tabIndex={0}
              aria-label={t("importDropzone")}
              aria-disabled={validating}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileChosen(e.dataTransfer.files);
              }}
              onClick={openFilePicker}
              onKeyDown={handleDropzoneKeyDown}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                dragOver
                  ? "border-accent bg-accent/10"
                  : "border-border-default hover:border-border-light"
              }`}
            >
              {validating ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
                  <p className="text-sm text-text-secondary">
                    {t("importValidating")}
                  </p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-text-secondary" />
                  <p className="text-sm text-text-secondary">
                    {t("importDropzone")}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t("importMaxSize")}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  handleFileChosen(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        )}

        {/* ── Step: Preview ─────────────────────────────────────────── */}
        {step === "preview" && parse && (
          <div className="flex flex-col gap-4 min-w-0">
            {/* File chip */}
            <div className="flex items-center gap-2 rounded-md border border-border-default bg-bg-elevated px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 text-text-secondary shrink-0" />
              <span className="text-sm text-text-primary truncate flex-1">
                {file?.name}
              </span>
              <button
                type="button"
                onClick={resetState}
                className="shrink-0 rounded p-1 text-text-secondary hover:text-text-primary"
                aria-label={t("importRemoveFile")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Fatal: missing columns */}
            {hasFatal && (
              <div className="flex gap-3 rounded-md border border-error/40 bg-error/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-error mt-0.5" />
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-error">
                    {t("importMissingColumnsTitle")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parse.missingColumns.map((col) => (
                      <Badge
                        key={col}
                        variant="error"
                        className="font-mono text-[11px]"
                      >
                        {col}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {t("importMissingColumnsHint")}
                  </p>
                </div>
              </div>
            )}

            {/* Warning: unknown columns */}
            {parse.unknownColumns.length > 0 && (
              <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-warning">
                    {t("importUnknownColumnsTitle")}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {parse.unknownColumns.join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* Warning: duplicate columns */}
            {parse.duplicateColumns.length > 0 && (
              <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-warning">
                    {t("importDuplicateColumnsTitle")}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {parse.duplicateColumns.join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* Warning: truncated */}
            {parse.truncated && (
              <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <p className="text-sm text-warning">
                  {t("importTruncatedHint")}
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span>
                {t("importSummary", {
                  total: parse.totalRows,
                  valid: validRows.length,
                  errors: errorRows.length,
                })}
              </span>
            </div>

            {/* Row table */}
            {parse.rows.length > 0 && (
              // No onWheel normalization here: this scroll area lives inside
              // the Dialog subtree, which react-remove-scroll whitelists. The
              // SearchableDropdown helper exists for portaled Popovers where
              // wheel events get cancelled.
              <div className="max-h-[360px] overflow-y-auto rounded-md border border-border-default">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-elevated">
                    <tr className="text-left text-text-muted">
                      <th className="w-10 px-3 py-2">
                        <Checkbox
                          checked={
                            validRows.length > 0 &&
                            selected.size === validRows.length
                          }
                          indeterminate={
                            selected.size > 0 &&
                            selected.size < validRows.length
                          }
                          onCheckedChange={toggleAll}
                          disabled={validRows.length === 0}
                        />
                      </th>
                      <th className="w-12 px-2 py-2">#</th>
                      {PREVIEW_COLUMNS.map(({ key, labelKey, className }) => (
                        <ColumnHeader
                          key={key}
                          label={t(labelKey)}
                          missing={missingColumns.includes(
                            TEMPLATE_COLUMN_LABELS[key]
                          )}
                          className={className}
                        />
                      ))}
                      <th className="w-24 px-2 py-2">{t("importStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parse.rows.map((row) => (
                      <PreviewRow
                        key={row.rowNumber}
                        row={row}
                        checked={selected.has(row.rowNumber)}
                        onToggle={() => toggleRow(row.rowNumber)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={resetState}>
                {t("importBack")}
              </Button>
              <Button
                onClick={() => setStep("strategy")}
                disabled={hasFatal || selectedCount === 0}
              >
                {t("importContinueWithCount", { count: selectedCount })}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Strategy ────────────────────────────────────────── */}
        {step === "strategy" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              {t("importStrategyDesc")}
            </p>
            <div className="flex flex-col gap-2">
              {DUPLICATE_STRATEGIES.map((s) => (
                <label
                  key={s}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                    strategy === s
                      ? "border-accent bg-accent/5"
                      : "border-border-default hover:border-border-light"
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={s}
                    checked={strategy === s}
                    onChange={() => setStrategy(s)}
                    className="mt-0.5 accent-accent"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-text-primary">
                      {t(`importStrategy_${s}`)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {t(`importStrategy_${s}_desc`)}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("preview")}>
                {t("importBack")}
              </Button>
              <Button onClick={handleConfirm} disabled={confirmDisabled}>
                {t("importConfirmWithCount", { count: selectedCount })}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Confirming ──────────────────────────────────────── */}
        {step === "confirming" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
            <p className="text-sm text-text-primary">{t("importImporting")}</p>
          </div>
        )}

        {/* ── Step: Result ──────────────────────────────────────────── */}
        {step === "result" && result && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm font-medium text-text-primary">
                {t("importDone")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatTile
                label={t("importStatInserted")}
                value={result.inserted}
              />
              <StatTile label={t("importStatUpdated")} value={result.updated} />
              <StatTile label={t("importStatSkipped")} value={result.skipped} />
              <StatTile
                label={t("importStatVersioned")}
                value={result.versioned}
              />
              <StatTile
                label={t("importStatFailed")}
                value={result.failed.length}
                tone={result.failed.length > 0 ? "error" : "default"}
              />
            </div>

            {result.failed.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border border-border-default">
                <table className="w-full text-xs">
                  <thead className="bg-bg-elevated text-left text-text-muted">
                    <tr>
                      <th className="w-12 px-2 py-2">#</th>
                      <th className="px-2 py-2">{t("colCode")}</th>
                      <th className="px-2 py-2">{t("importStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f) => (
                      <tr
                        key={`${f.rowNumber}-${f.code}`}
                        className="border-t border-border-default"
                      >
                        <td className="px-2 py-1.5 text-text-muted">
                          {f.rowNumber}
                        </td>
                        <td className="px-2 py-1.5 text-text-primary">
                          {f.code}
                        </td>
                        <td className="px-2 py-1.5 text-error">{f.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleDone}>{t("importClose")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function ColumnHeader({
  label,
  missing,
  className,
}: {
  label: string;
  missing: boolean;
  className?: string;
}) {
  return (
    <th className={cn("px-2 py-2", missing && "text-error", className)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {missing && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      </span>
    </th>
  );
}

function rawCell(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

function IssueRow({
  tone,
  items,
}: {
  tone: "error" | "warning";
  items: string[];
}) {
  const toneClasses =
    tone === "error" ? "bg-error/5 text-error" : "bg-warning/5 text-warning";
  return (
    <tr className={toneClasses}>
      <td className="px-3 pb-2" />
      <td colSpan={6} className="px-2 pb-2">
        <ul className="list-disc pl-4 text-[11px] space-y-0.5">
          {items.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

function PreviewRow({
  row,
  checked,
  onToggle,
}: {
  row: ParsedElementRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("elements");
  const isValid = row.status === "valid";
  const hasWarnings = row.warnings.length > 0;
  const raw = row.raw;
  return (
    <>
      <tr
        className={cn(
          "border-t border-border-default",
          !isValid && "bg-error/5",
          isValid && hasWarnings && "bg-warning/5"
        )}
      >
        <td className="px-3 py-1.5">
          {isValid && <Checkbox checked={checked} onCheckedChange={onToggle} />}
        </td>
        <td className="px-2 py-1.5 text-text-muted">{row.excelRowNumber}</td>
        <td className="px-2 py-1.5 text-text-primary truncate max-w-[120px]">
          {rawCell(raw, "Code")}
        </td>
        <td className="px-2 py-1.5 text-text-primary truncate max-w-[180px]">
          {rawCell(raw, "Name")}
        </td>
        <td className="px-2 py-1.5 text-text-secondary">
          {rawCell(raw, "Unit")}
        </td>
        <td className="px-2 py-1.5 text-right text-text-secondary">
          {rawCell(raw, "Unit Cost")}
        </td>
        <td className="px-2 py-1.5">
          {!isValid ? (
            <Badge variant="error">{t("importStatusError")}</Badge>
          ) : hasWarnings ? (
            <Badge variant="warning">{t("importStatusWarning")}</Badge>
          ) : (
            <Badge variant="success">{t("importStatusValid")}</Badge>
          )}
        </td>
      </tr>
      {!isValid && row.errors.length > 0 && (
        <IssueRow tone="error" items={row.errors} />
      )}
      {isValid && hasWarnings && (
        <IssueRow tone="warning" items={row.warnings} />
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-md border px-3 py-2 ${
        tone === "error"
          ? "border-error/40 bg-error/5"
          : "border-border-default bg-bg-elevated"
      }`}
    >
      <span
        className={`text-lg font-semibold ${
          tone === "error" ? "text-error" : "text-text-primary"
        }`}
      >
        {value}
      </span>
      <span className="text-[11px] text-text-muted text-center">{label}</span>
    </div>
  );
}
