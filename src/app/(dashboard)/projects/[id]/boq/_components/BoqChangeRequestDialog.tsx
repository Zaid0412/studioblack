"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FormDialog } from "@/components/ui/FormDialog";

interface BoqChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title — distinguishes single vs bulk callers. */
  title?: string;
  /** Called with the trimmed, non-empty comment. Dialog closes after the promise resolves. */
  onSubmit: (comment: string) => void | Promise<void>;
}

/** Shared textarea styling — matches other BOQ form fields. */
export const TEXTAREA_CLS =
  "w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y";

/**
 * Comment-required prompt fired before either kick-back transition
 * (`internal_changes_requested` / `client_changes_requested`).
 *
 * Replaces the inline `window.prompt` previously used by the item drawer and
 * the bulk lifecycle picker — gives multi-line input, validation, and a UI
 * consistent with the rest of the BOQ surface (matches CLAUDE.md's
 * "always use custom UI components" rule).
 */
export function BoqChangeRequestDialog({
  open,
  onOpenChange,
  title = "Request changes",
  onSubmit,
}: BoqChangeRequestDialogProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on every open so re-using the dialog never carries stale text.
  useEffect(() => {
    if (open) {
      setComment("");
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="What needs to change before this can be re-approved?"
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Request changes"
      submittingLabel="Working…"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Reason</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          required
          autoFocus
          maxLength={2000}
          className={TEXTAREA_CLS}
          placeholder="Describe the change requested…"
        />
      </label>
    </FormDialog>
  );
}
