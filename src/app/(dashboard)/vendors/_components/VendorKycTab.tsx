"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { formatDate } from "@/lib/formatDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useVendorKyc } from "@/hooks/useVendors";
import { useUserRole } from "@/hooks/useUserRole";
import { vendors as vendorsApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import {
  VENDOR_KYC_DOCUMENT_TYPES,
  VENDOR_KYC_STATUSES,
} from "@/lib/validations";
import type {
  VendorWithRelations,
  VendorKycDocumentType,
  VendorKycStatus,
} from "@/types";
import { VendorKycStatusBadge } from "./VendorKycStatusBadge";

interface Props {
  vendor: VendorWithRelations;
  enabled: boolean;
  onVendorMutate: () => void;
}

const EXPIRY_WARN_DAYS = 30;

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

  const [taxId, setTaxId] = useState(vendor.tax_id ?? "");
  const [taxIdSaving, setTaxIdSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<VendorKycStatus | null>(
    null
  );
  const [statusNotes, setStatusNotes] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  useEffect(() => {
    setTaxId(vendor.tax_id ?? "");
  }, [vendor.tax_id]);

  if (!enabled) return null;

  const handleSaveTaxId = async () => {
    const next = taxId.trim();
    const current = vendor.tax_id ?? "";
    if (next === current) return;
    setTaxIdSaving(true);
    try {
      await vendorsApi.update(vendor.id, { taxId: next || null });
      toast({ title: "Tax ID saved" });
      onVendorMutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: msg, variant: "error" });
    } finally {
      setTaxIdSaving(false);
    }
  };

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
      {/* Tax ID + status header */}
      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-input p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("kycStatus")}
          </h4>
          <VendorKycStatusBadge status={vendor.kyc_status} />
        </div>

        <Input
          label={t("taxId")}
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          onBlur={handleSaveTaxId}
          disabled={taxIdSaving}
          maxLength={50}
          placeholder={t("taxIdPlaceholder")}
        />

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

      {/* Document list */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("kycDocuments")}
          </h4>
          {!adding && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAdding(true)}
            >
              <Plus className="w-4 h-4" />
              {t("kycAddDocument")}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : documents.length === 0 && !adding ? (
          <p className="text-sm text-text-muted italic">
            {t("kycDocumentsEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => {
              const expiringSoon = isExpiringSoon(d.expires_at);
              const expired = isExpired(d.expires_at);
              return (
                <li
                  key={d.id}
                  className="rounded-lg border border-border-default bg-bg-input p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="info">
                        {t(`kycDocType_${d.doc_type}`)}
                      </Badge>
                      {expired && (
                        <Badge variant="error">{t("kycExpired")}</Badge>
                      )}
                      {expiringSoon && !expired && (
                        <Badge variant="warning">{t("kycExpiringSoon")}</Badge>
                      )}
                    </div>
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-text-primary hover:text-accent truncate"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{d.file_name}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                    </a>
                    <p className="text-xs text-text-muted">
                      {t("kycUploadedAt")}: {formatDate(d.uploaded_at)}
                      {d.expires_at &&
                        ` · ${t("kycExpiresAt")}: ${formatDate(d.expires_at)}`}
                    </p>
                    {d.notes && (
                      <p className="text-xs text-text-secondary whitespace-pre-line">
                        {d.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(d.id)}
                    aria-label={t("kycRemove")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {adding && (
          <AddDocumentForm
            vendorId={vendor.id}
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              await addDocument(input);
              setAdding(false);
            }}
          />
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={t("kycConfirmRemoveTitle")}
        description={t("kycConfirmRemoveDesc")}
        confirmLabel={t("kycRemove")}
        cancelLabel={tCommon("cancel")}
        destructive
        onConfirm={async () => {
          if (confirmDelete) await removeDocument(confirmDelete);
          setConfirmDelete(null);
        }}
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

function AddDocumentForm({
  onCancel,
  onSubmit,
}: {
  vendorId: string;
  onCancel: () => void;
  onSubmit: (input: {
    docType: VendorKycDocumentType;
    fileUrl: string;
    fileName: string;
    expiresAt: string | null;
    notes: string | null;
  }) => Promise<void>;
}) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");

  const [docType, setDocType] =
    useState<VendorKycDocumentType>("trade_licence");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!fileUrl && !!fileName && !submitting;

  const handleSubmit = async () => {
    if (!fileUrl || !fileName) return;
    setSubmitting(true);
    try {
      await onSubmit({
        docType,
        fileUrl,
        fileName,
        expiresAt: expiresAt ? format(expiresAt, "yyyy-MM-dd") : null,
        notes: notes.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-bg-input p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-text-secondary">
          {t("kycDocType")}
        </label>
        <Select
          value={docType}
          onValueChange={(v) => setDocType(v as VendorKycDocumentType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VENDOR_KYC_DOCUMENT_TYPES.map((dt) => (
              <SelectItem key={dt} value={dt}>
                {t(`kycDocType_${dt}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FileUploadSlot
        variant="file"
        label={t("kycFile")}
        url={fileUrl}
        fileName={fileName}
        onUploaded={({ url, fileName }) => {
          setFileUrl(url);
          setFileName(fileName);
        }}
        onCleared={() => {
          setFileUrl(null);
          setFileName(null);
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-text-secondary">
          {t("kycExpiresAt")}
        </label>
        <DatePicker
          value={expiresAt}
          onChange={setExpiresAt}
          placeholder={t("kycExpiresAtPlaceholder")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-text-secondary">
          {tCommon("notes")}
        </label>
        <textarea
          className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {tCommon("cancel")}
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isExpired(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d < startOfToday();
}

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = startOfToday();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + EXPIRY_WARN_DAYS);
  return d >= today && d <= cutoff;
}
