"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Upload, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";
import { SectionSelect } from "./SectionSelect";
import { NewSectionDialog } from "./NewSectionDialog";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sections: DbProjectDocumentSection[];
  /** Pre-fills the section picker (e.g. the currently active sidebar section). */
  initialSectionId?: string | null;
  /** Optional file to pre-populate (used for drag-and-drop into the page). */
  initialFile?: File | null;
  /**
   * Creates a new section and returns its row. The page handles SWR cache
   * revalidation + success toast so the side-effects stay consistent with
   * sidebar-driven creates.
   */
  onCreateSection: (data: {
    name: string;
    icon: string;
  }) => Promise<DbProjectDocumentSection>;
  /**
   * Called after the document is persisted. Receives the created row so
   * the parent can target only the affected section's SWR cache instead
   * of revalidating every section.
   */
  onSuccess: (created: DbProjectDocument) => void;
}

/**
 * Upload a single document via signed-URL PUT then register the row.
 *
 * Three editable fields on top of the file picker:
 *   - File name (extension preserved on save — only the base name is editable)
 *   - Description (optional)
 *   - Section (required to enable Upload — defaults to `initialSectionId`)
 *
 * Section creation is delegated upward: clicking "+ New section" in the picker
 * fires `onCreateSectionRequest` so the parent's existing NewSectionDialog
 * stays the single source of truth for that flow.
 */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  projectId,
  sections,
  initialSectionId,
  initialFile,
  onCreateSection,
  onSuccess,
}: UploadDocumentDialogProps) {
  // Lazy initial state: seeded from `initialFile` once at mount. Callers that
  // need to feed a new dropped file should remount via React `key` rather
  // than rely on a mirror effect (which would clobber the user's manual X).
  const [file, setFile] = useState<File | null>(() => initialFile ?? null);
  const [baseName, setBaseName] = useState<string>(
    () => splitFileName(initialFile?.name ?? "").base
  );
  const [description, setDescription] = useState("");
  const [sectionId, setSectionId] = useState<string | null>(
    initialSectionId ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const extension = useMemo(
    () => (file ? splitFileName(file.name).ext : ""),
    [file]
  );

  const reset = useCallback(() => {
    setFile(null);
    setBaseName("");
    setDescription("");
    setSectionId(initialSectionId ?? null);
    setUploading(false);
    setDragOver(false);
  }, [initialSectionId]);

  function handleSelect(picked: File | null) {
    if (!picked) return;
    if (picked.size > MAX_UPLOAD_SIZE) {
      toast({
        title: `File is larger than ${formatFileSize(MAX_UPLOAD_SIZE)}.`,
        variant: "error",
      });
      return;
    }
    setFile(picked);
    setBaseName(splitFileName(picked.name).base);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    if (!sectionId) {
      toast({ title: "Pick a section.", variant: "error" });
      return;
    }
    const trimmed = baseName.trim();
    if (!trimmed) {
      toast({ title: "File name can't be empty.", variant: "error" });
      return;
    }
    const finalName = joinFileName(trimmed, extension);
    setUploading(true);
    try {
      const { signedUrl, storagePath } = await projectDocuments.getUploadUrl(
        projectId,
        sectionId,
        { fileName: finalName, fileSize: file.size }
      );

      // PUT directly to Supabase. The content-type matters for downloads.
      const put = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
      });
      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`);
      }

      const trimmedDesc = description.trim();
      const created = await projectDocuments.createDocument(
        projectId,
        sectionId,
        {
          fileName: finalName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          storagePath,
          description: trimmedDesc || null,
        }
      );

      toast({ title: "Document uploaded." });
      reset();
      onOpenChange(false);
      onSuccess(created);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      toast({ title: message, variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  const canUpload = !!file && !!sectionId && baseName.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Max {formatFileSize(MAX_UPLOAD_SIZE)}. PDFs, images, Office files.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleSelect(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex flex-col items-center justify-center gap-2 px-6 py-10 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
              dragOver
                ? "border-accent bg-accent/5"
                : "border-border-light bg-bg-secondary hover:bg-bg-elevated"
            }`}
          >
            <Upload className="w-6 h-6 text-text-muted" />
            <p className="text-sm font-medium text-text-primary">
              Drop a file here or click to browse
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
            />
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-3 border border-border-light rounded-lg min-w-0">
              <div className="p-2 bg-error/10 rounded-md shrink-0">
                <FileText className="w-5 h-5 text-error" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-text-primary truncate"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-text-muted">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setBaseName("");
                  }}
                  className="shrink-0 p-1.5 text-text-muted hover:text-text-primary cursor-pointer"
                  aria-label="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">
                File name<span className="text-error ml-0.5">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    placeholder="Rename before uploading"
                    maxLength={245}
                    disabled={uploading}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a note about this document"
                rows={3}
                maxLength={2000}
                disabled={uploading}
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
            </div>

            <SectionSelect
              label="Section"
              required
              value={sectionId}
              onChange={setSectionId}
              sections={sections}
              onCreateNew={() => setCreateSectionOpen(true)}
              disabled={uploading}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!canUpload || uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </DialogContent>
      <NewSectionDialog
        open={createSectionOpen}
        onOpenChange={setCreateSectionOpen}
        onSubmit={async (data) => {
          const created = await onCreateSection(data);
          setSectionId(created.id);
          setCreateSectionOpen(false);
        }}
      />
    </Dialog>
  );
}
