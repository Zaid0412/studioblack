"use client";

import { use, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatFileSize, UPLOAD_ACCEPTED_TYPES } from "@/lib/fileUtils";
import { upload, attachments } from "@/lib/api";

/** Design file upload page with drag & drop. */
export default function DesignUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    phaseId?: string;
    phaseName?: string;
    versionGroup?: string;
  }>;
}) {
  const { id } = use(params);
  const { phaseId, phaseName, versionGroup } = use(searchParams);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr]);
    setError("");
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

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

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      for (const file of files) {
        const { url, fileName } = await upload.uploadFile(file);
        await attachments.create(id, {
          fileUrl: url,
          fileName,
          description,
          phaseId: phaseId || null,
          ...(versionGroup ? { versionGroup } : {}),
        });
      }

      setSuccess(true);
      setFiles([]);
      setDescription("");

      // Go back after a short delay
      setTimeout(() => {
        router.push(`/projects/${id}`);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to project
      </button>

      <PageHeader
        title="Upload Design"
        subtitle={
          phaseName
            ? `Phase: ${decodeURIComponent(phaseName)}${versionGroup ? " (New Version)" : ""}`
            : versionGroup
              ? "(New Version)"
              : undefined
        }
      />

      {success ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-12">
          <CheckCircle2 className="w-12 h-12 text-success" />
          <p className="text-sm font-medium text-success">
            Files uploaded successfully! Redirecting...
          </p>
        </div>
      ) : (
        <>
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${
              dragOver
                ? "border-accent bg-accent/10"
                : "border-border-light bg-bg-secondary hover:border-accent/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-bg-elevated">
              <Upload className="w-6 h-6 text-text-secondary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">
                Drop files here or click to upload
              </p>
              <p className="text-xs text-text-muted mt-1">
                Supports PDF, DWG, and image files up to 50MB
              </p>
            </div>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary">
                Selected Files ({files.length})
              </label>
              <div className="flex flex-col gap-2">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-border-default bg-bg-elevated px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-text-muted" />
                      <div className="flex flex-col">
                        <span className="text-sm text-text-primary">
                          {file.name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-text-muted hover:text-error transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">
              Design Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes about this design revision..."
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              rows={4}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button
            className="self-start"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Design
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
