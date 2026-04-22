"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  Pencil,
  Check,
} from "lucide-react";
import {
  formatFileSize,
  getFileExtension,
  UPLOAD_ACCEPTED_TYPES,
} from "@/lib/fileUtils";
import { useBatchUpload } from "@/hooks/useBatchUpload";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId: string | null;
  versionGroup?: string | null;
  initialFiles?: File[];
  onSuccess: () => void;
}

/** Modal dialog for uploading files to a project phase. */
export function UploadDialog({
  open,
  onOpenChange,
  projectId,
  phaseId,
  versionGroup,
  initialFiles,
  onSuccess,
}: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [displayNames, setDisplayNames] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const {
    uploading,
    error,
    uploadBatch,
    reset: resetBatchUpload,
  } = useBatchUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      const selected = versionGroup ? [initialFiles[0]] : initialFiles;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding local state from prop when dialog opens is intentional
      setFiles(selected);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding local state from prop when dialog opens is intentional
      setDisplayNames(selected.map((f) => f.name));
    }
  }, [open, initialFiles, versionGroup]);

  const resetState = useCallback(() => {
    setFiles([]);
    setDisplayNames([]);
    setEditingIndex(null);
    setEditValue("");
    setDescription("");
    setSuccess(false);
    setDragOver(false);
    resetBatchUpload();
  }, [resetBatchUpload]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState]
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      if (versionGroup) {
        setFiles([arr[0]]);
        setDisplayNames([arr[0].name]);
      } else {
        setFiles((prev) => [...prev, ...arr]);
        setDisplayNames((prev) => [...prev, ...arr.map((f) => f.name)]);
      }
    },
    [versionGroup]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setDisplayNames((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  }, []);

  const startEditing = useCallback(
    (index: number) => {
      const name = displayNames[index] || files[index].name;
      const ext = getFileExtension(name);
      // Strip extension for editing — we'll re-append it on confirm
      const baseName = ext ? name.slice(0, -(ext.length + 1)) : name;
      setEditingIndex(index);
      setEditValue(baseName);
      // Focus the input after render
      setTimeout(() => editInputRef.current?.focus(), 0);
    },
    [displayNames, files]
  );

  const confirmRename = useCallback(
    (index: number) => {
      const trimmed = editValue.trim();
      if (trimmed) {
        const ext = getFileExtension(displayNames[index] || files[index].name);
        const newName = ext ? `${trimmed}.${ext}` : trimmed;
        setDisplayNames((prev) => {
          const next = [...prev];
          next[index] = newName;
          return next;
        });
      }
      setEditingIndex(null);
      setEditValue("");
    },
    [editValue, displayNames, files]
  );

  const handleUpload = async () => {
    if (files.length === 0) return;

    const result = await uploadBatch({
      files,
      projectId,
      phaseId: phaseId || null,
      versionGroup,
      description,
      displayNames,
    });

    if (result.completed) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        resetState();
        onOpenChange(false);
      }, 1000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {versionGroup ? "Upload New Version" : "Upload Design"}
          </DialogTitle>
          <DialogDescription>
            Drag &amp; drop files or click to browse
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm text-text-primary">Uploaded successfully!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-w-0">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-5 lg:p-8 transition-colors ${
                dragOver
                  ? "border-accent bg-accent/10"
                  : "border-border-default hover:border-border-light"
              }`}
            >
              <Upload className="h-8 w-8 text-text-secondary" />
              <p className="text-sm text-text-secondary">
                {versionGroup
                  ? "Drop a file here or click to browse"
                  : "Drop files here or click to browse"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={UPLOAD_ACCEPTED_TYPES}
                multiple={!versionGroup}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-3 rounded-md border border-border-default bg-bg-secondary px-3 py-2 overflow-hidden"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
                    <div className="min-w-0 flex-1">
                      {editingIndex === i ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename(i);
                              if (e.key === "Escape") {
                                setEditingIndex(null);
                                setEditValue("");
                              }
                            }}
                            className="w-full min-w-0 rounded border border-accent bg-bg-primary px-1.5 py-0.5 text-sm text-text-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => confirmRename(i)}
                            className="shrink-0 rounded p-0.5 text-accent hover:bg-accent/10 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(i)}
                          className="group flex items-center gap-1.5 min-w-0 max-w-full cursor-pointer"
                        >
                          <p className="truncate text-sm text-text-primary">
                            {displayNames[i] || file.name}
                          </p>
                          <Pencil className="h-3 w-3 shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                      <p className="text-xs text-text-secondary">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-border-default hover:text-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            <textarea
              rows={2}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent"
            />

            {/* Error */}
            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* Footer */}
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
