"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { projectDocuments } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/useToast";
import { MAX_UPLOAD_SIZE } from "@/lib/fileUtils";
import { formatFileSize } from "@/lib/fileUtils";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sectionId: string;
  sectionName: string;
  /** Optional file to pre-populate (used for drag-and-drop into the page). */
  initialFile?: File | null;
  onSuccess: () => void;
}

/** Upload a single document via signed-URL PUT then register the row. */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  projectId,
  sectionId,
  sectionName,
  initialFile,
  onSuccess,
}: UploadDocumentDialogProps) {
  // Lazy initial state: seeded from `initialFile` once at mount. Callers that
  // need to feed a new dropped file should remount via React `key` rather
  // than rely on a mirror effect (which would clobber the user's manual X).
  const [file, setFile] = useState<File | null>(() => initialFile ?? null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setUploading(false);
    setDragOver(false);
  }, []);

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
  }

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const { signedUrl, storagePath } = await projectDocuments.getUploadUrl(
        projectId,
        sectionId,
        { fileName: file.name, fileSize: file.size }
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

      await projectDocuments.createDocument(projectId, sectionId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        storagePath,
      });

      toast({ title: "Document uploaded." });
      reset();
      onOpenChange(false);
      onSuccess();
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
          <DialogTitle>Upload to {sectionName}</DialogTitle>
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
          <div className="flex items-center gap-3 p-3 border border-border-light rounded-lg">
            <div className="p-2 bg-error/10 rounded-md">
              <FileText className="w-5 h-5 text-error" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {file.name}
              </p>
              <p className="text-xs text-text-muted">
                {formatFileSize(file.size)}
              </p>
            </div>
            {!uploading && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1.5 text-text-muted hover:text-text-primary cursor-pointer"
                aria-label="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
