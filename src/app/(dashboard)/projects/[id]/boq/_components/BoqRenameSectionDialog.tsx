"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/FormDialog";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { BoqDivisionSelect } from "./BoqDivisionSelect";
import type { CreateSectionPayload } from "@/lib/api/boq";
import type { BoqSection } from "@/types";

interface BoqRenameSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  section: BoqSection | null;
}

/** Edit a BOQ section's title and division. No-ops when nothing changed. */
export function BoqRenameSectionDialog({
  open,
  onOpenChange,
  projectId,
  section,
}: BoqRenameSectionDialogProps) {
  const { updateSection } = useBoqMutations(projectId);
  const [title, setTitle] = useState("");
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && section) {
      setTitle(section.title);
      setDivisionId(section.division_id);
    }
  }, [open, section]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section) return;
    const trimmed = title.trim();

    const patch: Partial<Omit<CreateSectionPayload, "boqId">> = {};
    if (trimmed && trimmed !== section.title) patch.title = trimmed;
    if (divisionId !== section.division_id) patch.divisionId = divisionId;
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      await updateSection(section.id, patch);
      toast({ title: "Section updated", variant: "success" });
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
      title="Edit section"
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Save"
      submittingLabel="Saving..."
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Title</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">
          Division
        </span>
        <BoqDivisionSelect value={divisionId} onChange={setDivisionId} />
      </label>
    </FormDialog>
  );
}
