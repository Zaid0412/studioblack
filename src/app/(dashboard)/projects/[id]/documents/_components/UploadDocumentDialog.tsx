"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { projectDocuments } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/useToast";
import {
  MAX_UPLOAD_SIZE,
  formatFileSize,
  joinFileName,
  splitFileName,
} from "@/lib/fileUtils";
import { runSettledWithConcurrency } from "@/lib/concurrency";
import { cn } from "@/lib/utils";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";
import { SectionSelect } from "./SectionSelect";
import { NewSectionDialog } from "./NewSectionDialog";

const UPLOAD_CONCURRENCY = 5;

type EntryStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  /** Stable id — survives reorders / removes. */
  id: string;
  file: File;
  baseName: string;
  description: string;
  status: EntryStatus;
  errorMessage?: string;
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sections: DbProjectDocumentSection[];
  /** Pre-fills the section picker (e.g. the currently active sidebar section). */
  initialSectionId?: string | null;
  /** Optional files to pre-populate (used for drag-and-drop into the page). */
  initialFiles?: File[];
  /**
   * When set, the dialog switches to "upload new version" mode for an
   * existing document. Section picker is hidden (the new row inherits the
   * current section), only a single file is allowed, and the CTA labels
   * itself with the next version number.
   */
  versionOf?: {
    documentId: string;
    fileName: string;
    currentVersion: number;
  };
  /** See note on `UploadDocumentDialog`. */
  onCreateSection: (data: {
    name: string;
    icon: string;
    parentId?: string | null;
  }) => Promise<DbProjectDocumentSection>;
  /**
   * Called once with every successfully-created document row in the batch.
   * In versionOf mode this contains the single new version row.
   * Empty array means everything failed; never called with `null`.
   */
  onSuccess: (created: DbProjectDocument[]) => void;
}

/**
 * Multi-file upload with a master-detail layout: a sidebar lists every file
 * in the batch (with status badge), and the right pane shows the currently-
 * selected file's editable fields (filename + description).
 *
 * Section is shared across the batch. Concurrency is bounded so the browser
 * doesn't fire N simultaneous PUTs to Supabase.
 */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  projectId,
  sections,
  initialSectionId,
  initialFiles,
  versionOf,
  onCreateSection,
  onSuccess,
}: UploadDocumentDialogProps) {
  const isVersionMode = !!versionOf;
  // Filter oversized files silently at mount — the caller (page-level drop
  // handler) is responsible for surfacing rejection toasts. The dialog
  // applies the same cap to user-added files inside `addFiles`, where it
  // can toast directly.
  const [entries, setEntries] = useState<FileEntry[]>(() =>
    (initialFiles ?? []).filter((f) => f.size <= MAX_UPLOAD_SIZE).map(makeEntry)
  );
  // Selection isn't seeded explicitly — `selected` below derives from the
  // current entries so the first file is shown by default and a removal
  // automatically picks the next one without an effect.
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [sectionId, setSectionId] = useState<string | null>(
    initialSectionId ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // AbortController for the in-flight upload batch. Aborted on Cancel / close
  // so in-flight signed-URL fetches, PUTs, and createDocument writes don't
  // continue after the user navigated away.
  const abortRef = useRef<AbortController | null>(null);

  // Derive selection from current entries so the dialog stays consistent
  // when the selected file is removed. First-entry fallback keeps the
  // detail pane populated as long as anything is in the batch. Inline
  // because `entries` is small (<50 in practice) — the useMemo bookkeeping
  // costs more than the lookup.
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
    setSectionId(initialSectionId ?? null);
    setUploading(false);
    setDragOver(false);
  }, [initialSectionId]);

  function addFiles(picked: FileList | File[] | null) {
    if (!picked) return;
    let arr = Array.from(picked);
    // Version mode is single-file. Drop everything past the first picked file
    // and toast so the user knows; this is friendlier than silently slicing.
    if (isVersionMode) {
      if (arr.length > 1) {
        toast({
          title: "Only one file per new version. Extra files were ignored.",
          variant: "warning",
        });
      }
      arr = arr.slice(0, 1);
    }
    const rejected: string[] = [];
    const accepted = arr.filter((f) => {
      if (f.size > MAX_UPLOAD_SIZE) {
        rejected.push(f.name);
        return false;
      }
      return true;
    });
    if (rejected.length > 0) {
      toast({
        title: `${rejected.length} file${rejected.length === 1 ? "" : "s"} exceeded ${formatFileSize(MAX_UPLOAD_SIZE)}.`,
        variant: "error",
      });
    }
    if (accepted.length === 0) return;
    const versionBaseName = versionOf
      ? splitFileName(versionOf.fileName).base
      : null;
    const additions = accepted.map((f) =>
      versionBaseName
        ? { ...makeEntry(f), baseName: versionBaseName }
        : makeEntry(f)
    );
    // In version mode the new file *replaces* whatever was there before.
    if (isVersionMode) {
      setEntries(additions);
      setSelectedId(additions[0].id);
      return;
    }
    // Surface the first-added file in the detail pane if the batch was
    // empty before. Selecting an entry that already exists is a no-op via
    // the `?? entries[0]` fallback, so always-set is also fine — but
    // we'd lose the user's current selection when adding more files.
    if (entries.length === 0) setSelectedId(additions[0].id);
    setEntries((prev) => [...prev, ...additions]);
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelectedId((cur) => (cur === id ? undefined : cur));
  }

  const canUpload =
    entries.length > 0 &&
    (isVersionMode || !!sectionId) &&
    entries.every((e) => e.baseName.trim().length > 0);

  async function handleUpload() {
    if (uploading || !canUpload) return;
    if (isVersionMode && versionOf) {
      await handleUploadVersion(versionOf);
      return;
    }
    if (!sectionId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    // Snapshot the queue + mark every member as "uploading" in one render —
    // status updates after this come from `onSettled` per finished task, so
    // the user sees live progress (spinner → check / error) one at a time.
    const queue = entries.filter((e) => e.status !== "done");
    setEntries((prev) =>
      prev.map((e) => (e.status === "done" ? e : { ...e, status: "uploading" }))
    );

    const results = await runSettledWithConcurrency(
      queue.length,
      UPLOAD_CONCURRENCY,
      async (i) => {
        const entry = queue[i];
        const ext = splitFileName(entry.file.name).ext;
        const finalName = joinFileName(entry.baseName.trim(), ext);
        const { signedUrl, storagePath } = await projectDocuments.getUploadUrl(
          projectId,
          sectionId,
          { fileName: finalName, fileSize: entry.file.size },
          { signal: controller.signal }
        );
        const put = await fetch(signedUrl, {
          method: "PUT",
          body: entry.file,
          headers: {
            "content-type": entry.file.type || "application/octet-stream",
          },
          signal: controller.signal,
        });
        if (!put.ok) throw new Error(`PUT failed (${put.status})`);
        const trimmedDesc = entry.description.trim();
        return projectDocuments.createDocument(
          projectId,
          sectionId,
          {
            fileName: finalName,
            fileSize: entry.file.size,
            mimeType: entry.file.type || "application/octet-stream",
            storagePath,
            description: trimmedDesc || null,
          },
          { signal: controller.signal }
        );
      },
      (i, result) => {
        if (controller.signal.aborted) return;
        const id = queue[i].id;
        setEntries((prev) =>
          prev.map((e) => {
            if (e.id !== id) return e;
            return result.ok
              ? { ...e, status: "done" }
              : {
                  ...e,
                  status: "error",
                  errorMessage: extractErrorMessage(result.error),
                };
          })
        );
      },
      controller.signal
    );

    // If aborted, `reset()` already cleared state — skip the toast/onSuccess
    // dance since the user explicitly walked away from the batch.
    if (controller.signal.aborted) return;

    abortRef.current = null;
    setUploading(false);

    const created = results.flatMap((r) => (r.ok ? [r.value] : []));
    const okCount = created.length;
    const failCount = results.length - okCount;
    if (okCount > 0) {
      onSuccess(created);
      toast({
        title:
          okCount === 1
            ? "Document uploaded."
            : `Uploaded ${okCount} documents.`,
      });
    }
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

  /**
   * Single-file path used when the dialog is opened in `versionOf` mode.
   * Mirrors the upload-url → PUT → register sequence of `handleUpload` but
   * targets the version endpoints and bypasses section handling.
   */
  async function handleUploadVersion(target: {
    documentId: string;
    fileName: string;
    currentVersion: number;
  }) {
    const entry = entries[0];
    if (!entry) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setEntries((prev) =>
      prev.map((e) => ({ ...e, status: "uploading" as EntryStatus }))
    );
    try {
      const ext = splitFileName(entry.file.name).ext;
      const finalName = joinFileName(entry.baseName.trim(), ext);
      const { signedUrl, storagePath } =
        await projectDocuments.getNewVersionUploadUrl(
          projectId,
          target.documentId,
          { fileName: finalName, fileSize: entry.file.size },
          { signal: controller.signal }
        );
      const put = await fetch(signedUrl, {
        method: "PUT",
        body: entry.file,
        headers: {
          "content-type": entry.file.type || "application/octet-stream",
        },
        signal: controller.signal,
      });
      if (!put.ok) throw new Error(`PUT failed (${put.status})`);
      const trimmedDesc = entry.description.trim();
      const created = await projectDocuments.createNewVersion(
        projectId,
        target.documentId,
        {
          fileName: finalName,
          fileSize: entry.file.size,
          mimeType: entry.file.type || "application/octet-stream",
          storagePath,
          description: trimmedDesc || null,
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      onSuccess([created]);
      toast({ title: `Uploaded as V${created.version}.` });
      reset();
      onOpenChange(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      setEntries((prev) =>
        prev.map((e) => ({
          ...e,
          status: "error",
          errorMessage: extractErrorMessage(err),
        }))
      );
      toast({
        title: extractErrorMessage(err),
        variant: "error",
      });
    } finally {
      if (!controller.signal.aborted) {
        abortRef.current = null;
        setUploading(false);
      }
    }
  }

  const nextVersionNumber = versionOf ? versionOf.currentVersion + 1 : null;
  const dialogTitle = isVersionMode
    ? `Upload new version of ${versionOf!.fileName}`
    : entries.length > 1
      ? `Upload ${entries.length} documents`
      : "Upload document";
  const dialogSubtitle = isVersionMode
    ? `New row will land at V${nextVersionNumber}. Section is inherited.`
    : `Max ${formatFileSize(MAX_UPLOAD_SIZE)} per file. PDFs, images, Office files.`;
  const uploadLabel = uploading
    ? "Uploading…"
    : isVersionMode
      ? `Upload as V${nextVersionNumber}`
      : entries.length > 1
        ? `Upload ${entries.length} files`
        : "Upload";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogSubtitle}</DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <DropZone
            dragOver={dragOver}
            setDragOver={setDragOver}
            onPick={() => inputRef.current?.click()}
            onFiles={addFiles}
            inputRef={inputRef}
            singleFile={isVersionMode}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {!isVersionMode && (
              <SectionSelect
                label="Section"
                required
                value={sectionId}
                onChange={setSectionId}
                sections={sections}
                onCreateNew={() => setCreateSectionOpen(true)}
                disabled={uploading}
              />
            )}

            {isVersionMode ? (
              selected && (
                <FileDetailPane
                  key={selected.id}
                  entry={selected}
                  onChange={(patch) => updateEntry(selected.id, patch)}
                  disabled={uploading}
                />
              )
            ) : (
              <div className="flex gap-3 h-[360px]">
                <FileTabList
                  entries={entries}
                  selectedId={selected?.id}
                  onSelect={setSelectedId}
                  onRemove={removeEntry}
                  onAddMore={() => inputRef.current?.click()}
                  disabled={uploading}
                />
                {selected && (
                  <FileDetailPane
                    key={selected.id}
                    entry={selected}
                    onChange={(patch) => updateEntry(selected.id, patch)}
                    disabled={uploading}
                  />
                )}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              multiple={!isVersionMode}
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
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!canUpload || uploading}>
              {uploadLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
      <NewSectionDialog
        open={createSectionOpen}
        onOpenChange={setCreateSectionOpen}
        sections={sections}
        onSubmit={async (data) => {
          const created = await onCreateSection(data);
          setSectionId(created.id);
          setCreateSectionOpen(false);
        }}
      />
    </Dialog>
  );
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Upload failed";
}

function makeEntry(file: File): FileEntry {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    baseName: splitFileName(file.name).base,
    description: "",
    status: "pending",
  };
}

// ─── Drop zone ──────────────────────────────────────────────────────────────

function DropZone({
  dragOver,
  setDragOver,
  onPick,
  onFiles,
  inputRef,
  singleFile,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onPick: () => void;
  onFiles: (files: FileList | File[] | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  singleFile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
        dragOver
          ? "border-accent bg-accent/5"
          : "border-border-light bg-bg-secondary hover:bg-bg-elevated"
      )}
    >
      <Upload className="w-6 h-6 text-text-muted" />
      <p className="text-sm font-medium text-text-primary">
        {singleFile
          ? "Drop the new version here or click to browse"
          : "Drop files here or click to browse"}
      </p>
      <p className="text-xs text-text-muted">
        {singleFile
          ? "One file replaces the latest version. Old versions remain in the history."
          : "Multiple files supported — each goes into the batch you can review before uploading."}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple={!singleFile}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </button>
  );
}

// ─── File tab list (left pane) ──────────────────────────────────────────────

function FileTabList({
  entries,
  selectedId,
  onSelect,
  onRemove,
  onAddMore,
  disabled,
}: {
  entries: FileEntry[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  disabled: boolean;
}) {
  return (
    <div className="w-[220px] shrink-0 flex flex-col gap-2 rounded-lg border border-border-default bg-bg-elevated p-2 overflow-y-auto">
      {entries.map((e) => (
        <FileTab
          key={e.id}
          entry={e}
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

function FileTab({
  entry,
  selected,
  onSelect,
  onRemove,
  disabled,
}: {
  entry: FileEntry;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
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
          ? "bg-accent/10 border border-accent/40"
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
          {entry.baseName.trim() || entry.file.name}
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
      <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
    );
  if (status === "done")
    return <Check className="w-3.5 h-3.5 text-success shrink-0" />;
  if (status === "error")
    return <AlertTriangle className="w-3.5 h-3.5 text-error shrink-0" />;
  return (
    <FileText
      className={cn(
        "w-3.5 h-3.5 shrink-0",
        selected ? "text-accent" : "text-text-muted"
      )}
    />
  );
}

// ─── Detail pane (right) ────────────────────────────────────────────────────

function FileDetailPane({
  entry,
  onChange,
  disabled,
}: {
  entry: FileEntry;
  onChange: (patch: Partial<FileEntry>) => void;
  disabled: boolean;
}) {
  const extension = useMemo(
    () => splitFileName(entry.file.name).ext,
    [entry.file.name]
  );
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3 rounded-lg border border-border-default p-4 overflow-y-auto">
      {entry.status === "error" && (
        <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
          {entry.errorMessage ?? "Upload failed."}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">
          File name<span className="text-error ml-0.5">*</span>
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Input
              value={entry.baseName}
              onChange={(e) => onChange({ baseName: e.target.value })}
              maxLength={245}
              disabled={disabled || entry.status === "done"}
            />
          </div>
          {extension && (
            <span className="text-xs text-text-muted shrink-0 select-none">
              {extension}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">
          Description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          value={entry.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Add a note about this document"
          rows={6}
          maxLength={2000}
          disabled={disabled || entry.status === "done"}
          className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
      </div>

      <div className="text-xs text-text-muted pt-1 mt-auto border-t border-border-default">
        <p className="pt-2 truncate" title={entry.file.name}>
          Original: {entry.file.name}
        </p>
        <p>{formatFileSize(entry.file.size)}</p>
      </div>
    </div>
  );
}
