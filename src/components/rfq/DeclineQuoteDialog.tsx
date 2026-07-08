"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
      title="Decline to quote"
      description={`${
        vendorName
          ? `Record that ${vendorName} won't be quoting this RFQ.`
          : "Let the studio know you won't be quoting this RFQ."
      } You can still submit a quote later.`}
      confirmLabel="Decline"
      submitting={submitting}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-text-secondary">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. outside our current capacity"
          className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
        />
      </div>
    </ConfirmDialog>
  );
}
