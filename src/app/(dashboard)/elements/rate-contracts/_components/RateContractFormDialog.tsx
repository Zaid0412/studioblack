"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AttachmentsEditor,
  type AttachmentRef,
} from "@/components/ui/AttachmentsEditor";
import { API } from "@/lib/api/routes";
import { rateContracts as rcApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import {
  RATE_CONTRACT_TYPES,
  RATE_CONTRACT_PRICE_BASES,
  type RateContractType,
  type RateContractPriceBasis,
} from "@/lib/validations";
import {
  RATE_CONTRACT_TYPE_ICONS,
  RATE_CONTRACT_PRICE_BASIS_ICONS,
} from "@/lib/rateContractLabels";
import type { RateContract } from "@/types";
import type { VendorListRow } from "@/lib/api/vendors";
import { toIsoDate, fromIsoDate } from "@/lib/formatDate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RateContract | null;
  onSaved: (contract: RateContract) => void;
}

interface FormState {
  vendorId: string;
  name: string;
  startDate: string;
  endDate: string;
  agreementSignedDate: string;
  currency: string;
  paymentTerms: string;
  attachments: AttachmentRef[];
  termsAndConditions: string;
  notes: string;
  contractType: RateContractType | "";
  creditPeriodDays: string;
  deliveryTerms: string;
  priceBasis: RateContractPriceBasis | "";
  renewalDate: string;
  projectId: string;
  taxIncluded: boolean;
  taxPercentage: string;
}

const EMPTY: FormState = {
  vendorId: "",
  name: "",
  startDate: "",
  endDate: "",
  agreementSignedDate: "",
  currency: "USD",
  paymentTerms: "",
  attachments: [],
  termsAndConditions: "",
  notes: "",
  contractType: "",
  creditPeriodDays: "",
  deliveryTerms: "",
  priceBasis: "",
  renewalDate: "",
  projectId: "",
  taxIncluded: false,
  taxPercentage: "",
};

/**
 * Trim ISO date / timestamp values to `YYYY-MM-DD`. The DB stores DATE
 * columns but pg can serialise them as either plain dates or full ISO
 * timestamps depending on driver state — normalise here so the form's
 * string state (and `fromIsoDate`) gets a clean date-only value.
 */
function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function contractToForm(c: RateContract): FormState {
  return {
    vendorId: c.vendor_id,
    name: c.name,
    startDate: toDateInput(c.start_date),
    endDate: toDateInput(c.end_date),
    agreementSignedDate: toDateInput(c.agreement_signed_date),
    currency: c.currency,
    paymentTerms: c.payment_terms ?? "",
    attachments: c.attachments ?? [],
    termsAndConditions: c.terms_and_conditions ?? "",
    notes: c.notes ?? "",
    contractType: c.contract_type ?? "",
    creditPeriodDays:
      c.credit_period_days != null ? String(c.credit_period_days) : "",
    deliveryTerms: c.delivery_terms ?? "",
    priceBasis: c.price_basis ?? "",
    renewalDate: toDateInput(c.renewal_date),
    projectId: c.project_id ?? "",
    taxIncluded: c.tax_included,
    taxPercentage: c.tax_percentage != null ? String(c.tax_percentage) : "",
  };
}

/** Create / edit dialog for the rate-contract header. */
export function RateContractFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: Props) {
  const t = useTranslations("rateContracts");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const { data: vendorData } = useSWR<{ rows: VendorListRow[] }>(
    open ? `${API.vendors()}?limit=200` : null
  );
  const vendors = vendorData?.rows ?? [];

  // Optional project scope — a contract is usually org-wide, so this can be left unset.
  const { data: projectData } = useSWR<{ id: string; name: string }[]>(
    open ? API.projects() : null
  );
  const projects = projectData ?? [];

  useEffect(() => {
    if (!open) return;
    setValues(editing ? contractToForm(editing) : EMPTY);
  }, [open, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setValues((s) => ({ ...s, [key]: value }));

  const isEdit = !!editing;
  // Once a contract is active, the server allow-lists which header fields
  // can be patched (notes / T&Cs / agreement / payment-terms / status). The
  // form mirrors that lock here so the user doesn't fight a 409 on save.
  const isLocked = isEdit && editing?.status === "active";

  /** Shared wiring for the ISO-string ↔ DatePicker date fields. */
  const dateProps = (
    key: "startDate" | "endDate" | "agreementSignedDate" | "renewalDate"
  ) => ({
    value: fromIsoDate(values[key]),
    onChange: (d: Date | undefined) => set(key, d ? toIsoDate(d) : ""),
    disabled: isLocked,
  });

  const canSubmit =
    values.vendorId &&
    values.name.trim() &&
    values.startDate &&
    values.endDate &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const opt = (s: string) => (s.trim() ? s.trim() : null);

    // Active-allowed subset. Including a locked field — even unchanged —
    // trips the server's allow-list check, so this is the whole payload
    // when isLocked.
    const editableFields = {
      paymentTerms: opt(values.paymentTerms),
      // AttachmentRef carries url + fileName (plus optional fileType/notes that
      // the server's schema strips) — pass it straight through.
      attachments: values.attachments,
      termsAndConditions: opt(values.termsAndConditions),
      notes: opt(values.notes),
    };

    setSubmitting(true);
    try {
      let saved: RateContract;
      if (isLocked && editing) {
        saved = await rcApi.update(editing.id, editableFields);
      } else {
        const fullFields = {
          ...editableFields,
          name: values.name.trim(),
          startDate: values.startDate,
          endDate: values.endDate,
          agreementSignedDate: values.agreementSignedDate || null,
          currency: values.currency,
          contractType: values.contractType || null,
          creditPeriodDays: values.creditPeriodDays.trim()
            ? Number(values.creditPeriodDays)
            : null,
          deliveryTerms: opt(values.deliveryTerms),
          priceBasis: values.priceBasis || null,
          renewalDate: values.renewalDate || null,
          projectId: values.projectId || null,
          taxIncluded: values.taxIncluded,
          taxPercentage: values.taxPercentage.trim()
            ? Number(values.taxPercentage)
            : null,
        };
        saved = editing
          ? await rcApi.update(editing.id, fullFields)
          : await rcApi.create({ ...fullFields, vendorId: values.vendorId });
      }
      toast({ title: editing ? t("toastUpdated") : t("toastCreated") });
      onSaved(saved);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editContract") : t("newContract")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isLocked && (
            <div className="flex items-start gap-2 rounded-md bg-info/10 p-3 text-xs text-info">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{t("activeLockedNotice")}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LabeledSearchableSelect
              label={t("vendor")}
              required
              disabled={isEdit}
              value={values.vendorId}
              onChange={(id) => set("vendorId", id)}
              options={vendors.map((v) => ({
                code: v.id,
                name: v.company_name,
              }))}
              triggerPlaceholder={t("vendorPickerPlaceholder")}
              hideTriggerCode
              codeColumnClassName="hidden"
              minContentWidth={320}
            />
            <Input
              label={t("contractName")}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              required
              maxLength={255}
              disabled={isLocked}
            />
            <DatePicker label={t("startDate")} {...dateProps("startDate")} />
            <DatePicker label={t("endDate")} {...dateProps("endDate")} />
            <DatePicker
              label={t("agreementSignedDate")}
              {...dateProps("agreementSignedDate")}
            />
            <CurrencySelect
              label={t("currency")}
              value={values.currency}
              onChange={(c) => set("currency", c)}
              required
              disabled={isLocked}
            />
            <Input
              label={t("paymentTerms")}
              value={values.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value)}
              maxLength={100}
              placeholder={t("paymentTermsPlaceholder")}
            />
            <LabeledSelect
              label={t("contractType")}
              value={values.contractType}
              onChange={(v) => set("contractType", v as RateContractType)}
              options={RATE_CONTRACT_TYPES.map((ct) => ({
                value: ct,
                label: t(`contractType_${ct}`),
                icon: RATE_CONTRACT_TYPE_ICONS[ct],
              }))}
              placeholder={t("contractTypePlaceholder")}
              disabled={isLocked}
            />
            <LabeledSelect
              label={t("priceBasis")}
              value={values.priceBasis}
              onChange={(v) => set("priceBasis", v as RateContractPriceBasis)}
              options={RATE_CONTRACT_PRICE_BASES.map((pb) => ({
                value: pb,
                label: t(`priceBasis_${pb}`),
                icon: RATE_CONTRACT_PRICE_BASIS_ICONS[pb],
              }))}
              placeholder={t("priceBasisPlaceholder")}
              disabled={isLocked}
            />
            <Input
              label={t("creditPeriodDays")}
              type="number"
              min="0"
              value={values.creditPeriodDays}
              onChange={(e) => set("creditPeriodDays", e.target.value)}
              disabled={isLocked}
            />
            <Input
              label={t("deliveryTerms")}
              value={values.deliveryTerms}
              onChange={(e) => set("deliveryTerms", e.target.value)}
              maxLength={100}
              placeholder={t("deliveryTermsPlaceholder")}
              disabled={isLocked}
            />
            <DatePicker
              label={t("renewalDate")}
              {...dateProps("renewalDate")}
            />
            <LabeledSearchableSelect
              label={t("project")}
              value={values.projectId}
              onChange={(id) => set("projectId", id)}
              options={projects.map((p) => ({ code: p.id, name: p.name }))}
              triggerPlaceholder={t("projectPlaceholder")}
              hideTriggerCode
              codeColumnClassName="hidden"
              disabled={isLocked}
            />
            <Input
              label={t("taxPercentage")}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={values.taxPercentage}
              onChange={(e) => set("taxPercentage", e.target.value)}
              placeholder={t("taxPercentagePlaceholder")}
              disabled={isLocked}
            />
          </div>

          <Checkbox
            checked={values.taxIncluded}
            onCheckedChange={(c) => set("taxIncluded", c)}
            label={t("taxIncluded")}
            disabled={isLocked}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("agreementFiles")}
            </label>
            <AttachmentsEditor
              value={values.attachments}
              onChange={(next) => set("attachments", next)}
              removeLabel={t("removeAttachment")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("termsAndConditions")}
            </label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
              rows={4}
              value={values.termsAndConditions}
              onChange={(e) => set("termsAndConditions", e.target.value)}
              maxLength={10_000}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("notes")}
            </label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
              rows={2}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={submitting}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? tCommon("loading") : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
