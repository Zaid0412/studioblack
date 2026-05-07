"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface BoqRequestChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (comment: string) => Promise<void>;
}

const MAX_COMMENT = 2000;

/**
 * Modal for requesting changes on a BOQ in `pending_internal_review`.
 * The comment is required (server enforces ≥ 1 char after trim) so the
 * creator gets a clear signal about what to fix.
 */
export function BoqRequestChangesDialog({
  open,
  onOpenChange,
  onSubmit,
}: BoqRequestChangesDialogProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset draft on close so the next open starts blank.
  useEffect(() => {
    if (!open) setComment("");
  }, [open]);

  const trimmed = comment.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_COMMENT;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
          <DialogDescription>
            The creator gets your comment with the bounce-back, so be specific
            about what needs fixing before this BOQ goes to the client.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <label
            htmlFor="boq-request-changes-comment"
            className="text-xs font-semibold text-text-primary"
          >
            What needs fixing? <span className="text-error">*</span>
          </label>
          <textarea
            id="boq-request-changes-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            maxLength={MAX_COMMENT}
            placeholder="e.g. Margin on Section 2 looks low — please double-check Anatolia Tile and the FF&E quantities on rows 11-14."
            className="rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y"
          />
          <span className="self-end text-[11px] text-text-muted tabular-nums">
            {trimmed.length} / {MAX_COMMENT}
          </span>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleSubmit}
            disabled={!valid || submitting}
          >
            {submitting ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
