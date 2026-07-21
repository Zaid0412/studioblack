"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilePreview } from "@/components/ui/FilePreview";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/useToast";
import { useProjectDocumentPreview } from "@/hooks/useProjectDocumentPreview";
import { projectDocuments } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  formatFileSize,
  getFileExtension,
  joinFileName,
  splitFileName,
} from "@/lib/fileUtils";
import { relativeTime } from "@/lib/formatTime";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";
import { SectionSelect } from "./SectionSelect";
import { NewSectionDialog } from "./NewSectionDialog";
import { DocumentVersionList } from "./DocumentVersionList";
import { UploadDocumentDialog } from "./UploadDocumentDialog";

interface DocumentDetailSheetProps {
  projectId: string;
  doc: DbProjectDocument | null;
  /** Open the sheet straight into edit mode (e.g. from the row's "Edit" menu). */
  startInEditMode?: boolean;
  sections: DbProjectDocumentSection[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (doc: DbProjectDocument) => void;
  onCreateSection: (data: {
    name: string;
    icon: string;
    parentId?: string | null;
  }) => Promise<DbProjectDocumentSection>;
  onDeleteRequest: (doc: DbProjectDocument) => void;
}

/**
 * Side-panel showing a document's preview + metadata, with an Edit mode that
 * swaps in editable inputs for filename, description, and section. Save fires
 * a single PATCH; cancel restores the original values.
 *
 * State is lazy-seeded from `doc` at mount, so callers MUST remount per doc
 * (e.g. `key={doc?.id}`) — otherwise stale state from a previous doc leaks
 * in. Lazy init is preferred over a mirror useEffect because the latter
 * silently clobbers in-progress edits if the parent re-renders with the
 * same doc but a flipped `startInEditMode`.
 *
 * The preview signed URL is fetched lazily via SWR per doc id. Focus
 * revalidation is OFF for this key — Supabase signed URLs are short-lived,
 * but re-minting one on tab focus would swap an open PDF iframe's `src`
 * mid-read, which is jarring.
 */
export function DocumentDetailSheet({
  projectId,
  doc,
  startInEditMode,
  sections,
  canEdit,
  onOpenChange,
  onUpdated,
  onCreateSection,
  onDeleteRequest,
}: DocumentDetailSheetProps) {
  const [editing, setEditing] = useState(() => !!startInEditMode);
  const [baseName, setBaseName] = useState(() =>
    doc ? splitFileName(doc.file_name).base : ""
  );
  const [description, setDescription] = useState(() => doc?.description ?? "");
  const [sectionId, setSectionId] = useState<string | null>(
    () => doc?.section_id ?? null
  );
  const [saving, setSaving] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);

  const extension = useMemo(
    () => (doc ? splitFileName(doc.file_name).ext : ""),
    [doc]
  );

  const { previewUrl, refreshUrl } = useProjectDocumentPreview(projectId, doc);

  function cancelEdit() {
    if (!doc) return;
    setBaseName(splitFileName(doc.file_name).base);
    setDescription(doc.description ?? "");
    setSectionId(doc.section_id);
    setEditing(false);
  }

  async function handleDownload() {
    if (!doc) return;
    try {
      const { url } = await projectDocuments.getDownloadUrl(projectId, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Download failed.",
        variant: "error",
      });
    }
  }

  async function handleSave() {
    if (!doc) return;
    const trimmedName = baseName.trim();
    if (!trimmedName) {
      toast({ title: "File name can't be empty.", variant: "error" });
      return;
    }
    if (!sectionId) {
      toast({ title: "Pick a section.", variant: "error" });
      return;
    }
    const finalName = joinFileName(trimmedName, extension);
    const trimmedDesc = description.trim();
    const patch: {
      fileName?: string;
      description?: string | null;
      sectionId?: string;
    } = {};
    if (finalName !== doc.file_name) patch.fileName = finalName;
    if (trimmedDesc !== (doc.description ?? ""))
      patch.description = trimmedDesc || null;
    if (sectionId !== doc.section_id) patch.sectionId = sectionId;
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await projectDocuments.updateDocument(
        projectId,
        doc.id,
        patch
      );
      onUpdated(updated);
      toast({ title: "Document updated." });
      setEditing(false);
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Update failed.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!doc} onOpenChange={onOpenChange}>
      {/* No description by design — the doc preview + meta speak for themselves.
          Explicit undefined silences Radix's a11y warning. */}
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          {/* Title + Edit button on the same row. `pr-10` keeps both clear
              of the sheet's absolute-positioned close X. */}
          <div className="flex items-center justify-between gap-3 pr-10">
            <SheetTitle className="truncate min-w-0">
              {doc?.file_name ?? ""}
            </SheetTitle>
            {doc && canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex shrink-0 items-center gap-1 text-xs text-text-muted hover:text-text-primary cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>
        </SheetHeader>

        {doc && (
          <SheetBody className="flex flex-col gap-5">
            <FilePreview
              url={previewUrl}
              fileName={doc.file_name}
              mimeType={doc.mime_type}
              // SheetBody is a flex column; without `shrink-0` the preview
              // gets compressed when edit-mode adds extra inputs, instead
              // of overflowing into the body's scroll area.
              className="shrink-0"
              refreshUrl={refreshUrl}
            />

            <section className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Description
              </span>
              {editing ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a note about this document"
                  rows={3}
                  maxLength={2000}
                  disabled={saving}
                  className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30"
                />
              ) : doc.description ? (
                <p className="text-sm text-text-primary whitespace-pre-wrap">
                  {doc.description}
                </p>
              ) : (
                <p className="text-sm italic text-text-muted">
                  No description.
                </p>
              )}
            </section>

            {editing && (
              <>
                <section className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    File name<span className="text-error ml-0.5">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={baseName}
                        onChange={(e) => setBaseName(e.target.value)}
                        maxLength={245}
                        disabled={saving}
                      />
                    </div>
                    {extension && (
                      <span className="text-xs text-text-muted shrink-0 select-none">
                        {extension}
                      </span>
                    )}
                  </div>
                </section>

                <SectionSelect
                  label="Section"
                  required
                  value={sectionId}
                  onChange={setSectionId}
                  sections={sections}
                  onCreateNew={() => setCreateSectionOpen(true)}
                  disabled={saving}
                />
              </>
            )}

            <section className="grid grid-cols-2 gap-3 text-sm">
              {/* In edit mode the SectionSelect above is the live section
                  picker, so the read-only Section field here would be
                  redundant (and confusing — two "Section" labels). */}
              {!editing && (
                <DetailField
                  label="Section"
                  value={
                    doc.section_name ??
                    sections.find((s) => s.id === doc.section_id)?.name ??
                    "—"
                  }
                />
              )}
              <DetailField
                label="Type"
                value={getFileExtension(doc.file_name).toUpperCase() || "—"}
              />
              <DetailField label="Size" value={formatFileSize(doc.file_size)} />
              <DetailField
                label="Uploaded"
                value={relativeTime(doc.created_at)}
              />
              <DetailField
                label="Uploaded by"
                value={doc.uploaded_by_name ?? "Unknown"}
                className="col-span-2"
              />
            </section>

            {!editing && (
              <div className="mt-4 pt-9 pb-6 border-t border-border-default">
                <DocumentVersionList
                  projectId={projectId}
                  doc={doc}
                  canEdit={canEdit}
                  onUploadNewVersion={() => setNewVersionOpen(true)}
                  onLatestChanged={onUpdated}
                />
              </div>
            )}
          </SheetBody>
        )}

        {doc && (
          <SheetFooter className="justify-between">
            {editing ? (
              <>
                <span className="text-xs text-text-muted">Editing…</span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    onClick={() => onDeleteRequest(doc)}
                    className="text-error hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </>
            )}
          </SheetFooter>
        )}
      </SheetContent>
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
      {doc && (
        <UploadDocumentDialog
          open={newVersionOpen}
          onOpenChange={setNewVersionOpen}
          projectId={projectId}
          sections={sections}
          onCreateSection={onCreateSection}
          versionOf={{
            documentId: doc.id,
            fileName: doc.file_name,
            currentVersion: doc.version,
          }}
          onSuccess={(created) => {
            if (created[0]) onUpdated(created[0]);
          }}
        />
      )}
    </Sheet>
  );
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm text-text-primary truncate">{value}</span>
    </div>
  );
}
