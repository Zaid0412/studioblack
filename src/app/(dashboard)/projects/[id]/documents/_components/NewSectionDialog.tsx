"use client";

import { useEffect, useState } from "react";
import { FormDialog } from "@/components/ui/FormDialog";
import type { DbProjectDocumentSection } from "@/types";
import { SectionNameAndIconFields } from "./SectionNameAndIconFields";
import { SectionSelect } from "./SectionSelect";

interface NewSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    icon: string;
    parentId: string | null;
  }) => Promise<void>;
  /**
   * Sections available as parents. Children (already-nested) are filtered
   * out at the picker level since they can't be parents themselves.
   */
  sections?: DbProjectDocumentSection[];
  /** Pre-fills the parent picker (e.g. "Add sub-section" on a parent row). */
  initialParentId?: string | null;
}

/**
 * Dialog for creating a new document section. The shared name + icon picker
 * lives in {@link SectionNameAndIconFields}; this dialog adds the optional
 * parent picker.
 */
export function NewSectionDialog({
  open,
  onOpenChange,
  onSubmit,
  sections,
  initialParentId,
}: NewSectionDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>("Folder");
  const [parentId, setParentId] = useState<string | null>(
    initialParentId ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  // Sync parent pre-fill when the dialog opens from a different entry point
  // (top-level "+ New section" vs "Add sub-section" on a specific parent).
  useEffect(() => {
    if (open) setParentId(initialParentId ?? null);
  }, [open, initialParentId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon, parentId });
      setName("");
      setIcon("Folder");
      setParentId(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setName("");
          setIcon("Folder");
          setParentId(null);
        }
        onOpenChange(v);
      }}
      title="New section"
      submitting={submitting}
      submitLabel="Create"
      submittingLabel="Creating…"
      onSubmit={handleSubmit}
    >
      <SectionNameAndIconFields
        name={name}
        icon={icon}
        onNameChange={setName}
        onIconChange={setIcon}
        namePlaceholder="e.g. Site Visits"
      />
      {sections && sections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionSelect
            label="Parent section (optional)"
            value={parentId}
            onChange={setParentId}
            // Children are already nested — they can't be parents themselves
            // under our one-level cap. They render dimmed in the picker.
            sections={sections}
            isSelectable={(s) => s.parent_id === null}
            placeholder="None — create at top level"
          />
          <p className="text-[11px] text-text-muted">
            Leave blank to create a top-level section.
          </p>
        </div>
      )}
    </FormDialog>
  );
}
