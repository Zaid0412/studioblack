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
import { Upload, FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import { formatFileSize, UPLOAD_ACCEPTED_TYPES } from "@/lib/fileUtils";
import { upload, attachments } from "@/lib/api";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId: string | null;
  versionGroup?: string | null;
  initialFiles?: File[];
  onSuccess: () => void;
}

/**
 *
 */
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
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(versionGroup ? [initialFiles[0]] : initialFiles);
    }
  }, [initialFiles, versionGroup]);

  const resetState = useCallback(() => {
    setFiles([]);
    setDescription("");
    setUploading(false);
    setSuccess(false);
    setError("");
    setDragOver(false);
  }, []);

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
      } else {
        setFiles((prev) => [...prev, ...arr]);
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
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");

    try {
      for (const file of files) {
        const { url, fileName } = await upload.uploadFile(file);
        await attachments.create(projectId, {
          fileUrl: url,
          fileName,
          description,
          phaseId: phaseId || null,
          ...(versionGroup ? { versionGroup } : {}),
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        resetState();
        onOpenChange(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
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
          <div className="flex flex-col gap-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? "border-accent bg-accent/10"
                  : "border-[#333333] hover:border-[#555555]"
              }`}
            >
              <Upload className="h-8 w-8 text-[#A0A0A0]" />
              <p className="text-sm text-[#A0A0A0]">
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
              <div className="flex flex-col gap-2">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-3 rounded-md border border-[#333333] bg-[#1A1A1A] px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[#A0A0A0]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{file.name}</p>
                      <p className="text-xs text-[#A0A0A0]">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="shrink-0 rounded p-1 text-[#A0A0A0] transition-colors hover:bg-[#333333] hover:text-white"
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
              className="w-full resize-none rounded-md border border-[#333333] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder-[#A0A0A0] outline-none focus:border-accent"
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
