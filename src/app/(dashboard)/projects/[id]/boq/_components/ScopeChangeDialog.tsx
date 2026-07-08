"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { toast } from "@/components/ui/useToast";
import { scopeChanges as scopeChangesApi } from "@/lib/api";
import {
  SCOPE_CHANGE_REASONS,
  SCOPE_CHANGE_IMPACTS,
  DEFAULT_IMPACT_FOR_REASON,
  type ScopeChangeReason,
  type ScopeChangeImpact,
} from "@/lib/validations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boqItemId: string;
  /** Called after a successful create so the caller can revalidate its list. */
  onCreated: () => void;
}

/** Raise a scope change against a BOQ item (studio). */
export function ScopeChangeDialog({
  open,
  onOpenChange,
  boqItemId,
  onCreated,
}: Props) {
  const t = useTranslations("scopeChanges");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState<ScopeChangeReason>("quantity");
  const [impact, setImpact] = useState<ScopeChangeImpact>(
    DEFAULT_IMPACT_FOR_REASON.quantity
  );
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset to defaults whenever the dialog re-opens.
  useEffect(() => {
    if (!open) return;
    setReason("quantity");
    setImpact(DEFAULT_IMPACT_FOR_REASON.quantity);
    setDescription("");
  }, [open]);

  const pickReason = (r: ScopeChangeReason) => {
    setReason(r);
    // Re-default the impact from the reason — the user can still override after.
    setImpact(DEFAULT_IMPACT_FOR_REASON[r]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await scopeChangesApi.create({
        boqItemId,
        changeReason: reason,
        impact,
        description: description.trim() || null,
      });
      toast({ title: t("toastCreated") });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <LabeledSelect
            label={t("changeReason")}
            value={reason}
            onChange={(v) => pickReason(v as ScopeChangeReason)}
            options={SCOPE_CHANGE_REASONS.map((r) => ({
              value: r,
              label: t(`reason_${r}`),
            }))}
          />
          <div className="flex flex-col gap-1.5">
            <LabeledSelect
              label={t("impact")}
              value={impact}
              onChange={(v) => setImpact(v as ScopeChangeImpact)}
              options={SCOPE_CHANGE_IMPACTS.map((i) => ({
                value: i,
                label: t(`impact_${i}`),
              }))}
            />
            <p className="text-xs text-text-muted">{t("impactHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("description")}
            </label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={submitting}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? tCommon("loading") : t("raise")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
