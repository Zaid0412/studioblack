"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useVendorKyc } from "@/hooks/useVendors";
import { useUserRole } from "@/hooks/useUserRole";
import { VENDOR_KYC_STATUSES } from "@/lib/validations";
import type { VendorWithRelations, VendorKycStatus } from "@/types";
import { KycDocumentList } from "@/components/vendors/KycDocumentList";
import { VendorKycStatusBadge } from "./VendorKycStatusBadge";

interface Props {
  vendor: VendorWithRelations;
  enabled: boolean;
  onVendorMutate: () => void;
}

/**
 * KYC tab inside the VendorDrawer.
 *
 * - Tax ID + status badge at the top. PM-only status-flip actions.
 * - Document list (type, name, expiry, "expiring soon" amber badge, remove).
 * - Inline "Add document" form with type select + FileUploadSlot.
 *
 * Read access: PM + Architect. Write KYC docs: PM + Architect.
 * `kyc_status` flip: **PM only** (server enforces).
 */
export function VendorKycTab({ vendor, enabled, onVendorMutate }: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");
  const { role } = useUserRole();
  const isPm = role === "pm";

  const { documents, isLoading, addDocument, removeDocument, setStatus } =
    useVendorKyc(vendor.id, enabled, onVendorMutate);

  const [pendingStatus, setPendingStatus] = useState<VendorKycStatus | null>(
    null
  );
  const [statusNotes, setStatusNotes] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  if (!enabled) return null;

  const handleStatusConfirm = async () => {
    if (!pendingStatus) return;
    setStatusSubmitting(true);
    try {
      await setStatus(pendingStatus, statusNotes.trim() || null);
      setPendingStatus(null);
      setStatusNotes("");
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 mt-4">
      {/* KYC status header */}
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-input p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("kycStatus")}
          </h4>
          <VendorKycStatusBadge status={vendor.kyc_status} />
        </div>

        {vendor.kyc_notes && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {t("kycReviewNotes")}
            </span>
            <p className="text-sm text-text-primary whitespace-pre-line">
              {vendor.kyc_notes}
            </p>
          </div>
        )}

        {isPm && (
          <div className="flex flex-wrap gap-2">
            {VENDOR_KYC_STATUSES.filter(
              (s) => s !== vendor.kyc_status && s !== "unverified"
            ).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "rejected" ? "danger" : "secondary"}
                onClick={() => {
                  setPendingStatus(s);
                  setStatusNotes("");
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                {t(`kycMark_${s}`)}
              </Button>
            ))}
          </div>
        )}
      </section>

      <KycDocumentList
        documents={documents}
        isLoading={isLoading}
        onAdd={async (input) => {
          await addDocument(input);
        }}
        onRemove={removeDocument}
      />

      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingStatus(null);
            setStatusNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingStatus ? t(`kycMark_${pendingStatus}`) : ""}
            </DialogTitle>
            <DialogDescription>{t("kycStatusChangeDesc")}</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
            rows={3}
            placeholder={t("kycReviewNotesPlaceholder")}
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            maxLength={2000}
          />
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                disabled={statusSubmitting}
              >
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={pendingStatus === "rejected" ? "danger" : "primary"}
              onClick={handleStatusConfirm}
              disabled={statusSubmitting}
            >
              {statusSubmitting ? tCommon("loading") : tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
