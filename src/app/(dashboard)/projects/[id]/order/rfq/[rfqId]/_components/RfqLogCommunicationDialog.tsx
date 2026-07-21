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
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { useRfqMutations } from "@/hooks/useRfqs";
import { toast } from "@/components/ui/useToast";
import {
  RFQ_MANUAL_RESPONSE_SOURCES,
  type RfqManualResponseSource,
} from "@/lib/validations";
import { RESPONSE_SOURCE_ICONS, RESPONSE_SOURCE_LABELS } from "@/lib/rfqLabels";

interface Vendor {
  vendor_id: string;
  vendor_name: string;
}

interface Props {
  projectId: string;
  rfqId: string;
  vendors: Vendor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}

const NO_VENDOR = "__none__";

/**
 * PRD §17: log a manual, channel-tagged communication against an RFQ (e.g. a
 * WhatsApp reminder or a phone call). Recorded as an audit event so it appears
 * in the RFQ activity timeline. Studio only.
 */
export function RfqLogCommunicationDialog({
  projectId,
  rfqId,
  vendors,
  open,
  onOpenChange,
  onLogged,
}: Props) {
  const t = useTranslations("rfq.logComm");
  const { logCommunication } = useRfqMutations(projectId);

  const [channel, setChannel] = useState<RfqManualResponseSource | "">("");
  const [vendorId, setVendorId] = useState<string>(NO_VENDOR);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setChannel("");
      setVendorId(NO_VENDOR);
      setRemarks("");
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSubmit = channel !== "" && remarks.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const ok = await logCommunication(rfqId, {
      channel,
      vendorId: vendorId === NO_VENDOR ? null : vendorId,
      remarks: remarks.trim(),
    });
    setSaving(false);
    if (ok) {
      toast({ title: t("saved"), variant: "success" });
      onLogged();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <LabeledSelect
            label={t("channelLabel")}
            value={channel}
            onChange={(v) => setChannel(v as RfqManualResponseSource)}
            options={RFQ_MANUAL_RESPONSE_SOURCES.map((c) => ({
              value: c,
              label: RESPONSE_SOURCE_LABELS[c],
              icon: RESPONSE_SOURCE_ICONS[c],
            }))}
            placeholder={t("channelPlaceholder")}
          />

          {vendors.length > 0 && (
            <LabeledSelect
              label={t("vendorLabel")}
              value={vendorId}
              onChange={setVendorId}
              options={[
                { value: NO_VENDOR, label: t("vendorNone") },
                ...vendors.map((v) => ({
                  value: v.vendor_id,
                  label: v.vendor_name,
                })),
              ]}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("remarksLabel")}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("remarksPlaceholder")}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30 resize-y min-h-[80px]"
            />
          </div>
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
