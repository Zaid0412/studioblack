"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Paperclip, X } from "lucide-react";
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
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";
import { useRfqMutations } from "@/hooks/useRfqs";
import { toast } from "@/components/ui/useToast";
import type { QuoteAttachment, RfqItem } from "@/types";

interface Props {
  projectId: string;
  rfqId: string;
  item: RfqItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const MAX_FILES = 20;

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
  const [uploadKey, setUploadKey] = useState(0);
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

        <div className="flex flex-col gap-2">
          {files.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {files.map((f, i) => (
                <li
                  key={f.url}
                  className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm"
                >
                  <Paperclip className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-text-secondary hover:text-text-primary"
                  >
                    {f.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={() => setFiles((s) => s.filter((_, j) => j !== i))}
                    aria-label={t("attachmentsRemove")}
                    className="text-text-muted hover:text-error transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length < MAX_FILES && (
            <FileUploadSlot
              key={uploadKey}
              variant="file"
              url={null}
              onUploaded={({ url, fileName }) => {
                setFiles((s) => [...s, { url, fileName }]);
                setUploadKey((k) => k + 1);
              }}
              onCleared={() => {}}
            />
          )}
        </div>

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
