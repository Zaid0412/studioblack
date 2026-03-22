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
          className="w-full rounded-lg border border-[#333333] bg-[#2A2A2A] px-3 py-2.5 text-sm text-white placeholder:text-[#666666] resize-none focus:outline-none focus:border-[#F5C518]"
          rows={4}
          autoFocus
        />
        <DialogFooter>
          <button
            onClick={() => {
              onOpenChange(false);
              onCommentChange("");
            }}
            className="px-4 py-2 text-[13px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
          >
            {tc("cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-[#F5C518] text-[#0D0D0D] rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-[#F5C518]/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
