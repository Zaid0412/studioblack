"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/FormDialog";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { BoqDivisionSelect } from "./BoqDivisionSelect";
import type { BoqSection } from "@/types";

interface BoqCreateSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  /** Used to seed `sortOrder` for the new section. */
  nextSortOrder: number;
  /** Fired after a successful create — used by BoqSectionSelect to auto-select. */
  onCreated?: (section: BoqSection) => void;
}

/** Dialog for creating a new BOQ section. Title required, everything else optional. */
export function BoqCreateSectionDialog({
  open,
  onOpenChange,
  projectId,
  boqId,
  nextSortOrder,
  onCreated,
}: BoqCreateSectionDialogProps) {
  const { createSection } = useBoqMutations(projectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDivisionId(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast({
        title: "Title required",
        description: "Give the section a short title.",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSection({
        boqId,
        title: trimmed,
        divisionId,
        description: description.trim() || null,
        sortOrder: nextSortOrder,
        isVisibleToClient: true,
      });
      toast({ title: "Section added", variant: "success" });
      onOpenChange(false);
      onCreated?.(created);
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
      title="Add section"
      description='Group items like "Civil Works" or "MEP".'
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Add section"
      submittingLabel="Adding..."
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Title</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
          autoFocus
          placeholder="e.g. Civil Works"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">
          Division (optional)
        </span>
        <BoqDivisionSelect value={divisionId} onChange={setDivisionId} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">
          Description (optional)
        </span>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Short summary of what this section covers"
        />
      </label>
    </FormDialog>
  );
}
