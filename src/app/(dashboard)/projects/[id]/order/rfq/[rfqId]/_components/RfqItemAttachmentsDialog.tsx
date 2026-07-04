"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AttachmentsEditor } from "@/components/ui/AttachmentsEditor";
import { useRfqMutations } from "@/hooks/useRfqs";
import { toast } from "@/components/ui/useToast";
import type { QuoteAttachment } from "@/types";

interface Props {
  projectId: string;
  rfqId: string;
  /** Only the fields this dialog needs — the caller passes an RFQ item row. */
  item: {
    id: string;
    description: string;
    attachments?: QuoteAttachment[];
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * PRD §11: manage an RFQ line's reference attachments (spec drawings). Studio
 * only — vendors see the files read-only on the RFQ detail. Mirrors the quote
 * evidence uploader: a JSONB list of {url, fileName}, replaced on Save.
 */
export function RfqItemAttachmentsDialog({
  projectId,
  rfqId,
  item,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const t = useTranslations("rfq.detail");
  const { updateItemAttachments } = useRfqMutations(projectId);
  const [files, setFiles] = useState<QuoteAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open && item) setFiles(item.attachments ?? []);
  }, [open, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateItemAttachments(rfqId, item.id, files);
    setSaving(false);
    if (ok) {
      toast({ title: t("attachmentsSaved"), variant: "success" });
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("attachmentsTitle")}</DialogTitle>
          <DialogDescription>
            {item.description} — {t("attachmentsHint")}
          </DialogDescription>
        </DialogHeader>

        <AttachmentsEditor
          value={files}
          onChange={setFiles}
          removeLabel={t("attachmentsRemove")}
        />

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={saving}>
              {t("attachmentsCancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("attachmentsSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
