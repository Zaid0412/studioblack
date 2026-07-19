"use client";

import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import {
  BatchUploadDialog,
  type UploadEntry,
} from "@/components/ui/BatchUploadDialog";
import { upload, attachments } from "@/lib/api";
import { splitFileName, joinFileName } from "@/lib/fileUtils";
import { DRAWING_TYPES } from "@/lib/validations";
import { DRAWING_TYPE_LABELS } from "@/lib/designTemplates";
import type { DbAttachment, DesignDiscipline } from "@/types";

/** Per-file editable fields for a design upload. */
interface DesignFields {
  baseName: string;
  description: string;
  disciplineId: string;
  drawingType: string;
}

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
  const { data } = useSWR<{ disciplines: DesignDiscipline[] }>(
    open && !isVersion ? "/api/design-disciplines" : null
  );
  const disciplines = data?.disciplines ?? [];

  const disciplineOptions = disciplines.map((d) => ({
    code: d.id,
    name: `${d.code} · ${d.name}`,
  }));
  const typeOptions = DRAWING_TYPES.map((t) => ({
    code: t,
    name: `${t} · ${DRAWING_TYPE_LABELS[t]}`,
  }));

  async function uploadEntry(entry: UploadEntry<DesignFields>) {
    const ext = splitFileName(entry.file.name).ext;
    const fileName = joinFileName(entry.fields.baseName.trim(), ext);
    const { url } = await upload.uploadFile(entry.file);
    return attachments.create(projectId, {
      fileUrl: url,
      fileName,
      description: entry.fields.description.trim(),
      phaseId,
      ...(isVersion
        ? { versionGroup: versionGroup! }
        : {
            disciplineId: entry.fields.disciplineId,
            drawingType: entry.fields.drawingType,
          }),
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
          : "Each file gets its own discipline, type, and document number."
      }
      uploadLabel={(uploading) => (uploading ? "Uploading…" : "Upload")}
      makeFields={(file) => ({
        baseName: splitFileName(file.name).base,
        description: "",
        disciplineId: "",
        drawingType: "",
      })}
      entryLabel={(e) => e.fields.baseName.trim() || e.file.name}
      isEntryValid={(e) =>
        e.fields.baseName.trim().length > 0 &&
        (isVersion || (!!e.fields.disciplineId && !!e.fields.drawingType))
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

            {!isVersion && (
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
                  options={typeOptions}
                  triggerPlaceholder="Select type"
                  hideCode
                  hideTriggerCode
                />
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
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>
        );
      }}
    />
  );
}
