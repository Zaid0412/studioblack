"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/FormDialog";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import type { BoqSection } from "@/types";

interface BoqRenameSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  section: BoqSection | null;
}

/** Rename an existing BOQ section. No-ops if the title is unchanged. */
export function BoqRenameSectionDialog({
  open,
  onOpenChange,
  projectId,
  section,
}: BoqRenameSectionDialogProps) {
  const { updateSection } = useBoqMutations(projectId);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && section) setTitle(section.title);
  }, [open, section]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === section.title) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    try {
      await updateSection(section.id, { title: trimmed });
      toast({ title: "Section renamed", variant: "success" });
      onOpenChange(false);
    } catch {
      // useBoqMutations already toasts.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename section"
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Save"
      submittingLabel="Saving..."
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={255}
        required
        autoFocus
      />
    </FormDialog>
  );
}
