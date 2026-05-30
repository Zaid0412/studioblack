"use client";

import { useState } from "react";
import { FormDialog } from "@/components/ui/FormDialog";
import { SectionNameAndIconFields } from "./SectionNameAndIconFields";

interface RenameSectionDialogProps {
  open: boolean;
  /** The section being renamed; controls dialog visibility + initial values. */
  initialName: string;
  initialIcon: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; icon: string }) => Promise<void>;
}

/** Edit a section's name + icon. Shares its picker with NewSectionDialog. */
export function RenameSectionDialog({
  open,
  initialName,
  initialIcon,
  onOpenChange,
  onSubmit,
}: RenameSectionDialogProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string>(initialIcon);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Rename "${initialName}"`}
      submitting={submitting}
      submitLabel="Save"
      submittingLabel="Saving…"
      onSubmit={handleSubmit}
    >
      <SectionNameAndIconFields
        name={name}
        icon={icon}
        onNameChange={setName}
        onIconChange={setIcon}
      />
    </FormDialog>
  );
}
