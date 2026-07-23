"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useFlag } from "@/hooks/useFlag";
import { Input } from "@/components/ui/input";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import {
  BatchUploadDialog,
  type UploadEntry,
} from "@/components/ui/BatchUploadDialog";
import { upload, attachments } from "@/lib/api";
import {
  splitFileName,
  joinFileName,
  UPLOAD_ACCEPTED_TYPES,
} from "@/lib/fileUtils";
import { DRAWING_TYPES, REPRESENTATIONS } from "@/lib/validations";
import {
  DRAWING_TYPE_LABELS,
  REPRESENTATION_LABELS,
} from "@/lib/designTemplates";
import type { DbAttachment, DesignDiscipline } from "@/types";

/** Per-file editable fields for a design upload. */
interface DesignFields {
  baseName: string;
  description: string;
  disciplineId: string;
  drawingType: string;
  representation: string;
  location: string;
}

/** Static — the drawing-type list never changes. */
const TYPE_OPTIONS = DRAWING_TYPES.map((t) => ({
  code: t,
  name: `${t} · ${DRAWING_TYPE_LABELS[t]}`,
}));

/** Static — the representation list never changes. */
const REPRESENTATION_OPTIONS = REPRESENTATIONS.map((r) => ({
  code: r,
  name: `${r} · ${REPRESENTATION_LABELS[r]}`,
}));

interface UploadDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId: string | null;
  /** New-version mode for an existing file lineage — classification is inherited. */
  versionGroup?: string | null;
  initialFiles?: File[];
  onSuccess: () => void;
}

/**
 * Design-file upload, built on the shared `BatchUploadDialog`. Unlike the old
 * dialog, each file in the batch carries its OWN discipline + drawing type (so a
 * mixed batch no longer has to share one classification), and the number is
 * allocated per file on the server (Document Control, PR-2).
 */
export function UploadDesignDialog({
  open,
  onOpenChange,
  projectId,
  phaseId,
  versionGroup,
  initialFiles,
  onSuccess,
}: UploadDesignDialogProps) {
  const isVersion = !!versionGroup;
  // Per-file classification (discipline + drawing type + document number) is
  // the Document Control feature — gated off restores the plain upload.
  const docControl = useFlag("designDocumentControl");
  const classify = !isVersion && docControl;
  const { data } = useSWR<{ disciplines: DesignDiscipline[] }>(
    open && classify ? "/api/design-disciplines" : null
  );

  const disciplineOptions = useMemo(
    () =>
      (data?.disciplines ?? []).map((d) => ({
        code: d.id,
        name: `${d.code} · ${d.name}`,
      })),
    [data]
  );

  async function uploadEntry(entry: UploadEntry<DesignFields>) {
    const ext = splitFileName(entry.file.name).ext;
    const fileName = joinFileName(entry.fields.baseName.trim(), ext);
    const { url } = await upload.uploadFile(entry.file);
    return attachments.create(projectId, {
      fileUrl: url,
      fileName,
      description: entry.fields.description.trim(),
      phaseId,
      ...(isVersion ? { versionGroup: versionGroup! } : {}),
      ...(classify
        ? {
            disciplineId: entry.fields.disciplineId,
            drawingType: entry.fields.drawingType,
            representation: entry.fields.representation,
            location: entry.fields.location.trim() || undefined,
          }
        : {}),
    });
  }

  return (
    <BatchUploadDialog<DesignFields, DbAttachment>
      open={open}
      onOpenChange={onOpenChange}
      initialFiles={initialFiles}
      singleFile={isVersion}
      title={isVersion ? "Upload new version" : "Upload design files"}
      subtitle={
        isVersion
          ? "One file replaces the latest version; classification is inherited."
          : classify
            ? "Each file gets its own discipline, type, representation, and document number."
            : "Add one or more files to this project."
      }
      uploadLabel="Upload"
      accept={UPLOAD_ACCEPTED_TYPES}
      makeFields={(file) => ({
        baseName: splitFileName(file.name).base,
        description: "",
        disciplineId: "",
        drawingType: "",
        representation: "",
        location: "",
      })}
      entryLabel={(e) => e.fields.baseName.trim() || e.file.name}
      isEntryValid={(e) =>
        e.fields.baseName.trim().length > 0 &&
        (!classify ||
          (!!e.fields.disciplineId &&
            !!e.fields.drawingType &&
            !!e.fields.representation))
      }
      uploadEntry={uploadEntry}
      onSuccess={onSuccess}
      renderDetail={(entry, onChange, disabled) => {
        const ext = splitFileName(entry.file.name).ext;
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
                    value={entry.fields.baseName}
                    onChange={(e) => onChange({ baseName: e.target.value })}
                    maxLength={245}
                    disabled={disabled || entry.status === "done"}
                  />
                </div>
                {ext && (
                  <span className="text-xs text-text-muted shrink-0 select-none">
                    {ext}
                  </span>
                )}
              </div>
            </div>

            {classify && (
              <div className="grid grid-cols-2 gap-3">
                <LabeledSearchableSelect<string>
                  label="Discipline"
                  required
                  value={entry.fields.disciplineId}
                  onChange={(v) => onChange({ disciplineId: v })}
                  options={disciplineOptions}
                  triggerPlaceholder="Select discipline"
                  hideCode
                  hideTriggerCode
                />
                <LabeledSearchableSelect<string>
                  label="Drawing type"
                  required
                  value={entry.fields.drawingType}
                  onChange={(v) => onChange({ drawingType: v })}
                  options={TYPE_OPTIONS}
                  triggerPlaceholder="Select type"
                  hideCode
                  hideTriggerCode
                />
                <LabeledSearchableSelect<string>
                  label="Representation"
                  required
                  value={entry.fields.representation}
                  onChange={(v) => onChange({ representation: v })}
                  options={REPRESENTATION_OPTIONS}
                  triggerPlaceholder="Select representation"
                  hideCode
                  hideTriggerCode
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    Location <span className="text-text-muted">(optional)</span>
                  </label>
                  <Input
                    value={entry.fields.location}
                    onChange={(e) => onChange({ location: e.target.value })}
                    placeholder="e.g. Ground Floor"
                    maxLength={120}
                    disabled={disabled || entry.status === "done"}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Description <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                value={entry.fields.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Add a note about this file"
                rows={3}
                maxLength={2000}
                disabled={disabled || entry.status === "done"}
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>
        );
      }}
    />
  );
}
