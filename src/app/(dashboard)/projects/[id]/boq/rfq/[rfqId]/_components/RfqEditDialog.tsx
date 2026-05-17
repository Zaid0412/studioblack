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
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useRfqMutations } from "@/hooks/useRfqs";
import type { Rfq } from "@/types";

interface Props {
  projectId: string;
  rfq: Rfq;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Edit-RFQ dialog. Header-only patch — title / scope / terms / response
 * deadline. The server rejects the call (409) once the RFQ leaves `draft`,
 * which is exactly the right behaviour — vendors have already seen the
 * scope by then, rewriting it silently would be a footgun. The caller is
 * expected to hide the trigger button on non-draft RFQs as a courtesy.
 */
export function RfqEditDialog({
  projectId,
  rfq,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const t = useTranslations("rfq.edit");
  const { update } = useRfqMutations(projectId);

  const [title, setTitle] = useState(rfq.title);
  const [scopeOfWork, setScopeOfWork] = useState(rfq.scope_of_work ?? "");
  const [termsConditions, setTermsConditions] = useState(
    rfq.terms_conditions ?? ""
  );
  const [deadline, setDeadline] = useState<Date | undefined>(
    rfq.response_deadline
      ? new Date(rfq.response_deadline + "T00:00:00")
      : undefined
  );
  const [saving, setSaving] = useState(false);

  // Reset form to the latest server state every time the dialog opens —
  // if a refresh happened between renders we don't want a stale draft.
  // Syncing from props on open is the intended use of useEffect here;
  // the alternative (keyed remount) would lose Radix's close animation.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setTitle(rfq.title);
      setScopeOfWork(rfq.scope_of_work ?? "");
      setTermsConditions(rfq.terms_conditions ?? "");
      setDeadline(
        rfq.response_deadline
          ? new Date(rfq.response_deadline + "T00:00:00")
          : undefined
      );
    }
  }, [open, rfq]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSubmit = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const result = await update(rfq.id, {
      title: title.trim(),
      scopeOfWork: scopeOfWork.trim() || null,
      termsConditions: termsConditions.trim() || null,
      responseDeadline: deadline ? toIsoDate(deadline) : null,
    });
    setSaving(false);
    if (result) {
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input
            label={t("titleField")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("scopeField")}
            </label>
            <textarea
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y min-h-[80px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("termsField")}
            </label>
            <textarea
              value={termsConditions}
              onChange={(e) => setTermsConditions(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y min-h-[80px]"
            />
          </div>

          <DatePicker
            label={t("deadlineField")}
            value={deadline}
            onChange={setDeadline}
            placeholder={t("deadlinePlaceholder")}
            className="max-w-xs"
          />
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={saving}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!canSubmit}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
