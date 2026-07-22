"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { emphasisTags } from "@/components/ui/richText";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Studio only: the vendor being declined on behalf of. */
  vendorName?: string;
  onConfirm: (reason: string | null) => Promise<void>;
}

/**
 * Confirm a vendor decline (§14) with an optional reason. Shared by the vendor
 * portal (vendor declines themselves) and the studio ("record a decline" on a
 * vendor's behalf). A decline can always be reversed by later submitting a quote.
 */
export function DeclineQuoteDialog({
  open,
  onOpenChange,
  vendorName,
  onConfirm,
}: Props) {
  const t = useTranslations("rfq.decline");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim() || null);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={
        vendorName
          ? t.rich("descriptionStudio", { ...emphasisTags, vendor: vendorName })
          : t("descriptionVendor")
      }
      confirmLabel={t("confirmLabel")}
      submitting={submitting}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-text-secondary">
          {t("reasonLabel")}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t("reasonPlaceholder")}
          className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
        />
      </div>
    </ConfirmDialog>
  );
}
