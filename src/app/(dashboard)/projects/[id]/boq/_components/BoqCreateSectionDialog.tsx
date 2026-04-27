"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { FormDialog } from "@/components/ui/FormDialog";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";

interface BoqCreateSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  /** Used to seed `sortOrder` for the new section. */
  nextSortOrder: number;
}

/** Dialog for creating a new BOQ section. Title required, everything else optional. */
export function BoqCreateSectionDialog({
  open,
  onOpenChange,
  projectId,
  boqId,
  nextSortOrder,
}: BoqCreateSectionDialogProps) {
  const { createSection } = useBoqMutations(projectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setVisibleToClient(true);
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
      await createSection({
        boqId,
        title: trimmed,
        description: description.trim() || null,
        sortOrder: nextSortOrder,
        isVisibleToClient: visibleToClient,
      });
      toast({ title: "Section added", variant: "success" });
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
      title="Add section"
      description='Group items like "Civil Works" or "MEP". Internal sections are hidden from client BOQ exports.'
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
          Description (optional)
        </span>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Short summary of what this section covers"
        />
      </label>

      <div className="flex items-center justify-between rounded-lg border border-border-default bg-bg-elevated px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text-primary">
            Visible to client
          </span>
          <span className="text-xs text-text-muted">
            Off = internal only (excluded from client BOQ).
          </span>
        </div>
        <ToggleSwitch checked={visibleToClient} onChange={setVisibleToClient} />
      </div>
    </FormDialog>
  );
}
