"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TagInput } from "@/components/ui/TagInput";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { toast } from "@/components/ui/useToast";
import { ApiError } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  OptionWithIcon,
} from "@/components/ui/select";
import { VENDOR_STATUS_ICONS } from "@/lib/vendorLabels";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VENDOR_STATUSES } from "@/lib/validations";
import type { VendorWithRelations, VendorStatus } from "@/types";
import {
  VendorContactsEditor,
  type ContactDraft,
} from "./VendorContactsEditor";
import { VendorTradesEditor, type TradeDraft } from "./VendorTradesEditor";
import {
  VendorAddressesEditor,
  type AddressDraft,
} from "./VendorAddressesEditor";

export interface VendorFormSubmit {
  companyName: string;
  tradingName?: string;
  vendorCode?: string;
  status?: VendorStatus;
  paymentTerms?: string;
  currency: string;
  vatRegistered: boolean;
  vatNumber?: string;
  gstin?: string;
  website?: string;
  preferredVendor: boolean;
  brandsSupported: string[];
  notes?: string;
  addresses: Array<{
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
    is_primary?: boolean;
  }>;
  contacts: Array<{
    name: string;
    title?: string;
    email: string;
    phone?: string;
    isPrimary?: boolean;
    isSecondary?: boolean;
    receivesRfq?: boolean;
  }>;
  trades: Array<{
    categoryId: string;
    proficiencyLevel?: "standard" | "specialist" | "preferred";
    notes?: string;
  }>;
}

interface FormState {
  companyName: string;
  tradingName: string;
  vendorCode: string;
  status: VendorStatus;
  paymentTerms: string;
  currency: string;
  vatRegistered: boolean;
  vatNumber: string;
  gstin: string;
  website: string;
  preferredVendor: boolean;
  brandsSupported: string[];
  notes: string;
  addresses: AddressDraft[];
  contacts: ContactDraft[];
  trades: TradeDraft[];
}

const EMPTY: FormState = {
  companyName: "",
  tradingName: "",
  vendorCode: "",
  status: "active",
  paymentTerms: "",
  currency: DEFAULT_CURRENCY,
  vatRegistered: false,
  vatNumber: "",
  gstin: "",
  website: "",
  preferredVendor: false,
  brandsSupported: [],
  notes: "",
  addresses: [],
  contacts: [],
  trades: [],
};

/**
 * Top-level fields whose server validation/conflict error is shown inline on
 * the input (red). Errors on any other path (nested contacts/addresses/trades,
 * or no field at all) fall back to a toast.
 */
const INLINE_ERROR_FIELDS = new Set([
  "companyName",
  "tradingName",
  "vendorCode",
  "paymentTerms",
  "vatNumber",
  "gstin",
  "website",
]);

/**
 * Hydrate the form from a saved vendor. Reads the new `addresses` array
 * and falls back to the legacy single `address` object for vendors not
 * yet migrated by the data backfill (the column still exists on the
 * row for one release while the new column rolls out).
 */
function vendorToForm(v: VendorWithRelations): FormState {
  const fallbackList: AddressDraft[] = v.address
    ? [
        {
          label: "",
          line1: v.address.line1 ?? "",
          line2: v.address.line2 ?? "",
          city: v.address.city ?? "",
          region: v.address.region ?? "",
          postal: v.address.postal ?? "",
          country: v.address.country ?? "",
          isPrimary: true,
        },
      ]
    : [];

  const fromArray: AddressDraft[] = (v.addresses ?? []).map((a) => ({
    label: a.label ?? "",
    line1: a.line1 ?? "",
    line2: a.line2 ?? "",
    city: a.city ?? "",
    region: a.region ?? "",
    postal: a.postal ?? "",
    country: a.country ?? "",
    isPrimary: !!a.is_primary,
  }));

  // Auto-promote the first address to primary if no row carries the flag.
  const addresses = fromArray.length > 0 ? fromArray : fallbackList;
  if (addresses.length > 0 && !addresses.some((a) => a.isPrimary)) {
    addresses[0] = { ...addresses[0], isPrimary: true };
  }

  return {
    companyName: v.company_name,
    tradingName: v.trading_name ?? "",
    vendorCode: v.vendor_code ?? "",
    status: v.status,
    paymentTerms: v.payment_terms ?? "",
    currency: v.currency ?? DEFAULT_CURRENCY,
    vatRegistered: v.vat_registered,
    vatNumber: v.vat_number ?? "",
    gstin: v.gstin ?? "",
    website: v.website ?? "",
    preferredVendor: !!v.preferred_vendor,
    brandsSupported: v.brands_supported ?? [],
    notes: v.notes ?? "",
    addresses,
    contacts: v.contacts.map((c) => ({
      name: c.name,
      title: c.title ?? "",
      email: c.email,
      phone: c.phone ?? "",
      isPrimary: c.is_primary,
      isSecondary: c.is_secondary,
      receivesRfq: c.receives_rfq,
    })),
    trades: v.trades.map((tr) => ({
      categoryId: tr.category_id,
      proficiencyLevel: tr.proficiency_level,
      notes: tr.notes ?? "",
    })),
  };
}

interface Props {
  open: boolean;
  editing: VendorWithRelations | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VendorFormSubmit) => Promise<void>;
}

/** Single dialog for creating + editing a vendor (mode driven by `editing`). */
export function VendorFormDialog({
  open,
  editing,
  submitting,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState<FormState>(EMPTY);
  /** Server validation/conflict errors, keyed by field name → shown inline. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate when dialog opens
    setValues(editing ? vendorToForm(editing) : EMPTY);
    setFieldErrors({});
  }, [editing, open]);

  const setField = <K extends keyof FormState>(key: K, v: FormState[K]) => {
    setValues((s) => ({ ...s, [key]: v }));
    // Clear a field's error as soon as the user edits it.
    setFieldErrors((p) => {
      if (!(key in p)) return p;
      const next = { ...p };
      delete next[key as string];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trim = (s: string) => s.trim();
    const opt = (s: string) => (trim(s) ? trim(s) : undefined);

    // Drop empty rows (every address field blank). What's left is what
    // the server persists.
    const addresses = values.addresses
      .map((a) => ({
        label: opt(a.label),
        line1: opt(a.line1),
        line2: opt(a.line2),
        city: opt(a.city),
        region: opt(a.region),
        postal: opt(a.postal),
        country: opt(a.country),
        is_primary: a.isPrimary || undefined,
      }))
      .filter((a) =>
        Object.entries(a).some(
          ([k, v]) => k !== "is_primary" && v !== undefined
        )
      );

    try {
      await onSubmit({
        companyName: trim(values.companyName),
        tradingName: opt(values.tradingName),
        vendorCode: opt(values.vendorCode),
        status: values.status,
        paymentTerms: opt(values.paymentTerms),
        currency: values.currency,
        vatRegistered: values.vatRegistered,
        vatNumber: opt(values.vatNumber),
        gstin: opt(values.gstin),
        website: opt(values.website),
        preferredVendor: values.preferredVendor,
        brandsSupported: values.brandsSupported,
        notes: opt(values.notes),
        addresses,
        contacts: values.contacts
          .filter((c) => c.name.trim() && c.email.trim())
          .map((c) => ({
            name: c.name.trim(),
            title: opt(c.title),
            email: c.email.trim(),
            phone: opt(c.phone),
            isPrimary: c.isPrimary,
            isSecondary: c.isSecondary,
            receivesRfq: c.receivesRfq,
          })),
        trades: values.trades.map((tr) => ({
          categoryId: tr.categoryId,
          proficiencyLevel: tr.proficiencyLevel,
          notes: opt(tr.notes),
        })),
      });
    } catch (err) {
      // Validation/conflict errors carry the offending `field` → flag that
      // input inline (red). Everything else falls back to a toast.
      if (
        err instanceof ApiError &&
        err.field &&
        INLINE_ERROR_FIELDS.has(err.field)
      ) {
        const field = err.field;
        // `error` is "field: message"; strip the path for a clean inline label.
        const message = err.message.startsWith(`${field}: `)
          ? err.message.slice(field.length + 2)
          : err.message;
        setFieldErrors((p) => ({ ...p, [field]: message }));
      } else {
        toast({
          title: err instanceof Error ? err.message : "Failed to save vendor",
          variant: "error",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("editVendor") : t("newVendor")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("companyName")}
              value={values.companyName}
              onChange={(e) => setField("companyName", e.target.value)}
              error={fieldErrors.companyName}
              required
              maxLength={255}
            />
            <Input
              label={t("tradingName")}
              value={values.tradingName}
              onChange={(e) => setField("tradingName", e.target.value)}
              error={fieldErrors.tradingName}
              maxLength={255}
            />
            <Input
              label={t("vendorCode")}
              value={values.vendorCode}
              onChange={(e) => setField("vendorCode", e.target.value)}
              error={fieldErrors.vendorCode}
              maxLength={50}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                {t("statusLabel")}
              </label>
              <Select
                value={values.status}
                onValueChange={(v) => setField("status", v as VendorStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <OptionWithIcon icon={VENDOR_STATUS_ICONS[s]}>
                        {t(`status_${s}`)}
                      </OptionWithIcon>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Commercial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label={t("paymentTerms")}
              value={values.paymentTerms}
              onChange={(e) => setField("paymentTerms", e.target.value)}
              error={fieldErrors.paymentTerms}
              maxLength={100}
              placeholder={t("paymentTermsPlaceholder")}
            />
            <CurrencySelect
              label={t("currency")}
              value={values.currency}
              onChange={(code) => setField("currency", code)}
              required
            />
            <Input
              label={t("vatNumber")}
              value={values.vatNumber}
              onChange={(e) => setField("vatNumber", e.target.value)}
              error={fieldErrors.vatNumber}
              maxLength={50}
              disabled={!values.vatRegistered}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox
              id="vat-registered"
              checked={values.vatRegistered}
              onCheckedChange={(c) => setField("vatRegistered", c)}
              label={t("vatRegistered")}
            />
            <Checkbox
              id="preferred-vendor"
              checked={values.preferredVendor}
              onCheckedChange={(c) => setField("preferredVendor", c)}
              label={t("preferredVendor")}
            />
          </div>

          {/* Compliance + presence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("gstin")}
              value={values.gstin}
              onChange={(e) => setField("gstin", e.target.value)}
              error={fieldErrors.gstin}
              maxLength={20}
              placeholder={t("gstinPlaceholder")}
            />
            <Input
              label={t("website")}
              value={values.website}
              onChange={(e) => setField("website", e.target.value)}
              error={fieldErrors.website}
              maxLength={500}
              placeholder={t("websitePlaceholder")}
              type="url"
            />
          </div>

          {/* Coverage — brands carried */}
          <TagInput
            label={t("brandsSupported")}
            value={values.brandsSupported}
            onChange={(tags) => setField("brandsSupported", tags)}
            placeholder={t("brandsSupportedPlaceholder")}
            maxTags={50}
          />

          {/* Addresses (multi-card editor — HQ / warehouse / billing / …) */}
          <VendorAddressesEditor
            addresses={values.addresses}
            onChange={(a) => setField("addresses", a)}
          />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("notes")}
            </label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary min-h-[70px] focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              value={values.notes}
              onChange={(e) => setField("notes", e.target.value)}
              maxLength={2000}
            />
          </div>

          {/* Contacts */}
          <VendorContactsEditor
            contacts={values.contacts}
            onChange={(c) => setField("contacts", c)}
          />

          {/* Trades */}
          <VendorTradesEditor
            trades={values.trades}
            onChange={(t) => setField("trades", t)}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              <Save className="w-4 h-4" />
              {submitting ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
