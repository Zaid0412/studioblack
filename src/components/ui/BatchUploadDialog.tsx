"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_SIZE, formatFileSize } from "@/lib/fileUtils";
import { toast } from "@/components/ui/useToast";
import { runSettledWithConcurrency } from "@/lib/concurrency";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import { useFileDropzone } from "@/hooks/useFileDropzone";
import { cn } from "@/lib/utils";

const UPLOAD_CONCURRENCY = 5;

export type EntryStatus = "pending" | "uploading" | "done" | "error";

/** One file in the batch, plus its per-file editable fields (`F`). */
export interface UploadEntry<F> {
  /** Stable id — survives reorders / removes. */
  id: string;
  file: File;
  fields: F;
  status: EntryStatus;
  errorMessage?: string;
}

interface BatchUploadDialogProps<F, R> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFiles?: File[];
  /** New-version mode: at most one file, no shared header, no "add more". */
  singleFile?: boolean;
  title: string;
  subtitle: string;
  /** CTA label — the shell appends "…" while uploading. */
  uploadLabel: string;
  /** `accept` attribute for the file picker (e.g. UPLOAD_ACCEPTED_TYPES). */
  accept?: string;
  /** Seed per-file fields from the File (e.g. baseName from the filename). */
  makeFields: (file: File) => F;
  /** Short label shown in the file tab list (usually a filename). */
  entryLabel: (entry: UploadEntry<F>) => string;
  /** The per-file detail pane (filename, description, classification, …). */
  renderDetail: (
    entry: UploadEntry<F>,
    onChange: (patch: Partial<F>) => void,
    disabled: boolean
  ) => React.ReactNode;
  /** Per-entry validity — the CTA is disabled until every entry passes. */
  isEntryValid: (entry: UploadEntry<F>) => boolean;
  /** Upload one file and return its created row (or throw). */
  uploadEntry: (entry: UploadEntry<F>, signal: AbortSignal) => Promise<R>;
  /** Called once with every successfully-created row in the batch. */
  onSuccess: (created: R[]) => void;
}

/**
 * Generic multi-file upload dialog with a master-detail layout: a drop zone
 * when empty, then a file-tab list (left) + a per-file detail pane (right),
 * bounded-concurrency uploads, and per-file status. The batch-specific bits —
 * the detail fields, the shared header, validation, and the actual upload — are
 * injected by the caller, so both design uploads and document uploads share one
 * shell (extracted from the original `UploadDocumentDialog`).
 */
export function BatchUploadDialog<F, R>({
  open,
  onOpenChange,
  initialFiles,
  singleFile,
  title,
  subtitle,
  uploadLabel,
  accept,
  makeFields,
  entryLabel,
  renderDetail,
  isEntryValid,
  uploadEntry,
  onSuccess,
}: BatchUploadDialogProps<F, R>) {
  const makeEntry = useCallback(
    (file: File): UploadEntry<F> => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${idSuffix()}`,
      file,
      fields: makeFields(file),
      status: "pending",
    }),
    [makeFields]
  );

  const [entries, setEntries] = useState<UploadEntry<F>[]>(() =>
    (initialFiles ?? [])
      .filter((f) => f.size <= MAX_UPLOAD_SIZE)
      .slice(0, singleFile ? 1 : undefined)
      .map(makeEntry)
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Derive selection so a removed selection falls back to the first entry.
  const selected =
    entries.length === 0
      ? undefined
      : (entries.find((e) => e.id === selectedId) ?? entries[0]);
  const successCount = entries.filter((e) => e.status === "done").length;
  const errorCount = entries.filter((e) => e.status === "error").length;

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEntries([]);
    setSelectedId(undefined);
    setUploading(false);
  }, []);

  const addFiles = useCallback(
    (picked: FileList | File[] | null) => {
      if (!picked) return;
      let arr = Array.from(picked);
      if (singleFile) arr = arr.slice(0, 1);

      const accepted: File[] = [];
      const rejected: string[] = [];
      for (const f of arr) {
        if (f.size > MAX_UPLOAD_SIZE) rejected.push(f.name);
        else accepted.push(f);
      }
      if (rejected.length > 0) {
        toast({
          title: `${rejected.length} file${rejected.length === 1 ? "" : "s"} exceeded ${formatFileSize(MAX_UPLOAD_SIZE)}.`,
          variant: "error",
        });
      }
      if (accepted.length === 0) return;
      const additions = accepted.map(makeEntry);
      if (singleFile) {
        setEntries(additions);
        setSelectedId(additions[0].id);
        return;
      }
      setEntries((prev) => {
        if (prev.length === 0) setSelectedId(additions[0].id);
        return [...prev, ...additions];
      });
    },
    [singleFile, makeEntry]
  );

  const { dragOver, handleDrop, handleDragOver, handleDragLeave } =
    useFileDropzone(addFiles);

  const updateFields = useCallback((id: string, patch: Partial<F>) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, fields: { ...e.fields, ...patch } } : e
      )
    );
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelectedId((cur) => (cur === id ? undefined : cur));
  }, []);

  const canUpload = entries.length > 0 && entries.every(isEntryValid);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  async function handleUpload() {
    if (uploading || !canUpload) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);

    const queue = entries.filter((e) => e.status !== "done");
    setEntries((prev) =>
      prev.map((e) => (e.status === "done" ? e : { ...e, status: "uploading" }))
    );

    const results = await runSettledWithConcurrency(
      queue.length,
      UPLOAD_CONCURRENCY,
      (i) => uploadEntry(queue[i], controller.signal),
      (i, result) => {
        if (controller.signal.aborted) return;
        const id = queue[i].id;
        setEntries((prev) =>
          prev.map((e) =>
            e.id !== id
              ? e
              : result.ok
                ? { ...e, status: "done" }
                : {
                    ...e,
                    status: "error",
                    errorMessage: extractErrorMessage(result.error),
                  }
          )
        );
      },
      controller.signal
    );

    if (controller.signal.aborted) return;
    abortRef.current = null;
    setUploading(false);

    const created = results.flatMap((r) => (r.ok ? [r.value] : []));
    const okCount = created.length;
    const failCount = results.length - okCount;
    if (okCount > 0) onSuccess(created);
    if (failCount === 0) {
      reset();
      onOpenChange(false);
    } else if (okCount > 0) {
      toast({
        title: `${failCount} file${failCount === 1 ? "" : "s"} failed. See the list for details.`,
        variant: "error",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <DropZone
            dragOver={dragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPick={() => inputRef.current?.click()}
            onFiles={addFiles}
            inputRef={inputRef}
            singleFile={singleFile}
            accept={accept}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {singleFile ? (
              selected &&
              renderDetail(
                selected,
                (patch) => updateFields(selected.id, patch),
                uploading
              )
            ) : (
              <div className="flex flex-col md:flex-row gap-3 md:h-[380px]">
                <FileTabList
                  entries={entries}
                  selectedId={selected?.id}
                  entryLabel={entryLabel}
                  onSelect={setSelectedId}
                  onRemove={removeEntry}
                  onAddMore={() => inputRef.current?.click()}
                  disabled={uploading}
                />
                {selected &&
                  renderDetail(
                    selected,
                    (patch) => updateFields(selected.id, patch),
                    uploading
                  )}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              multiple={!singleFile}
              accept={accept}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-text-muted">
            {uploading
              ? `${successCount + errorCount} of ${entries.length} done…`
              : errorCount > 0
                ? `${errorCount} failed`
                : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleClose(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!canUpload || uploading}>
              {uploading ? `${uploadLabel}…` : uploadLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function idSuffix(): string {
  // Non-crypto stable-enough id for a client-side list key.
  return Math.random().toString(36).slice(2, 8);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Upload failed";
}

// ─── Drop zone ──────────────────────────────────────────────────────────────

function DropZone({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onPick,
  onFiles,
  inputRef,
  singleFile,
  accept,
}: {
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onPick: () => void;
  onFiles: (files: FileList | File[] | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  singleFile?: boolean;
  accept?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
        dragOver
          ? "border-accent-strong bg-accent/5"
          : "border-border-light bg-bg-secondary hover:bg-bg-elevated"
      )}
    >
      <Upload className="w-6 h-6 text-text-muted" />
      <p className="text-sm font-medium text-text-primary">
        {singleFile
          ? "Drop a file here or click to browse"
          : "Drop files here or click to browse"}
      </p>
      <p className="text-xs text-text-muted">
        {singleFile
          ? "Only one file can be uploaded here."
          : "Multiple files supported — review each before uploading."}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple={!singleFile}
        accept={accept}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </button>
  );
}

// ─── File tab list (left pane) ──────────────────────────────────────────────

function FileTabList<F>({
  entries,
  selectedId,
  entryLabel,
  onSelect,
  onRemove,
  onAddMore,
  disabled,
}: {
  entries: UploadEntry<F>[];
  selectedId: string | undefined;
  entryLabel: (entry: UploadEntry<F>) => string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  disabled: boolean;
}) {
  const listRef = useStaggerReveal<HTMLDivElement>(
    entries.map((e) => e.id).join(",")
  );
  return (
    <div
      ref={listRef}
      className="w-full md:w-[220px] md:shrink-0 max-h-[180px] md:max-h-none flex flex-col gap-2 rounded-lg border border-border-default bg-bg-elevated p-2 overflow-y-auto"
    >
      {entries.map((e) => (
        <FileTab
          key={e.id}
          entry={e}
          label={entryLabel(e)}
          selected={e.id === selectedId}
          onSelect={() => onSelect(e.id)}
          onRemove={() => onRemove(e.id)}
          disabled={disabled}
        />
      ))}
      <button
        type="button"
        onClick={onAddMore}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        Add more files
      </button>
    </div>
  );
}

function FileTab<F>({
  entry,
  label,
  selected,
  onSelect,
  onRemove,
  disabled,
}: {
  entry: UploadEntry<F>;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-anim-item
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2.5 py-2 cursor-pointer transition-colors",
        selected
          ? "bg-accent/10 border border-accent-strong/40"
          : "border border-transparent hover:bg-bg-input"
      )}
    >
      <StatusIcon status={entry.status} selected={selected} />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs truncate",
            selected ? "text-text-primary font-semibold" : "text-text-secondary"
          )}
          title={entry.file.name}
        >
          {label || entry.file.name}
        </p>
        <p className="text-[10px] text-text-muted">
          {formatFileSize(entry.file.size)}
        </p>
      </div>
      {!disabled && entry.status !== "done" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-error hover:opacity-80 cursor-pointer transition-opacity"
          aria-label="Remove from batch"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusIcon({
  status,
  selected,
}: {
  status: EntryStatus;
  selected: boolean;
}) {
  if (status === "uploading")
    return (
      <Loader2 className="w-3.5 h-3.5 text-accent-strong animate-spin shrink-0" />
    );
  if (status === "done")
    return <Check className="w-3.5 h-3.5 text-success shrink-0" />;
  if (status === "error")
    return <AlertTriangle className="w-3.5 h-3.5 text-error shrink-0" />;
  return (
    <FileText
      className={cn(
        "w-3.5 h-3.5 shrink-0",
        selected ? "text-accent-strong" : "text-text-muted"
      )}
    />
  );
}
