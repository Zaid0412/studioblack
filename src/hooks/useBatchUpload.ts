"use client";

import { useCallback, useRef, useState } from "react";
import { upload, attachments } from "@/lib/api";
import { runWithConcurrency } from "@/lib/concurrency";

const UPLOAD_CONCURRENCY = 3;

export interface BatchUploadInput {
  files: File[];
  projectId: string;
  phaseId: string | null;
  versionGroup?: string | null;
  description?: string;
  /** Optional per-index filename override (e.g. user-edited display names). */
  displayNames?: string[];
  /** Drawing classification, applied to every NEW file in the batch (not versions). */
  disciplineId?: string | null;
  drawingType?: string | null;
}

export interface BatchUploadResult {
  /** True if every file in this batch (including previously-succeeded) has now been uploaded. */
  completed: boolean;
  /** Count of files uploaded so far across this batch's retries. */
  uploaded: number;
  total: number;
}

/**
 * Uploads files in parallel (bounded concurrency) and creates attachment rows.
 * Tracks per-batch succeeded indices in a ref so a partial failure can be
 * retried by re-calling `uploadBatch` — already-uploaded indices are skipped
 * and won't produce duplicate attachment rows.
 *
 * Call `reset()` when starting a fresh batch (e.g. dialog closed).
 */
export function useBatchUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadedRef = useRef<Set<number>>(new Set());

  const uploadBatch = useCallback(
    async (input: BatchUploadInput): Promise<BatchUploadResult> => {
      const { files } = input;
      if (files.length === 0) {
        return { completed: true, uploaded: 0, total: 0 };
      }

      setUploading(true);
      setError(null);

      const alreadyUploaded = uploadedRef.current;
      const justUploaded = new Set<number>();

      try {
        await runWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, i) => {
          if (alreadyUploaded.has(i)) return;
          const { url, fileName: uploadedName } = await upload.uploadFile(file);
          const fileName = input.displayNames?.[i] || uploadedName;
          await attachments.create(input.projectId, {
            fileUrl: url,
            fileName,
            description: input.description ?? "",
            phaseId: input.phaseId,
            ...(input.versionGroup
              ? { versionGroup: input.versionGroup }
              : {
                  disciplineId: input.disciplineId,
                  drawingType: input.drawingType,
                }),
          });
          justUploaded.add(i);
        });

        uploadedRef.current = new Set([...alreadyUploaded, ...justUploaded]);
        return {
          completed: true,
          uploaded: uploadedRef.current.size,
          total: files.length,
        };
      } catch (err) {
        uploadedRef.current = new Set([...alreadyUploaded, ...justUploaded]);
        const uploaded = uploadedRef.current.size;
        const total = files.length;
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(
          uploaded > 0
            ? `${msg} (${uploaded}/${total} files uploaded — click Upload to retry remaining)`
            : msg
        );
        return { completed: false, uploaded, total };
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setUploading(false);
    setError(null);
    uploadedRef.current = new Set();
  }, []);

  return { uploading, error, uploadBatch, reset };
}
