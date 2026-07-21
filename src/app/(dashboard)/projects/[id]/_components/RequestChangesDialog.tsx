"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RequestChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

/** Dialog for clients to submit a "request changes" decision with a comment. */
export function RequestChangesDialog({
  open,
  onOpenChange,
  comment,
  onCommentChange,
  submitting,
  onSubmit,
}: RequestChangesDialogProps) {
  const t = useTranslations("projectDetail");
  const tc = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("requestChangesTitle")}</DialogTitle>
          <DialogDescription>{t("requestChangesHint")}</DialogDescription>
        </DialogHeader>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={t("requestChangesPlaceholder")}
          className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent-strong"
          rows={4}
          autoFocus
        />
        <DialogFooter>
          <button
            onClick={() => {
              onOpenChange(false);
              onCommentChange("");
            }}
            className="px-4 py-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            {tc("cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-accent text-text-on-accent rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
