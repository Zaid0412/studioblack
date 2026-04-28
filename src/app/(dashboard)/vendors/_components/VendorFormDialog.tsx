"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export interface VendorFormSubmit {
  companyName: string;
  tradingName?: string;
  vendorCode?: string;
  status?: VendorStatus;
  paymentTerms?: string;
  currency: string;
  vatRegistered: boolean;
  vatNumber?: string;
  notes?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  };
  contacts: Array<{
    name: string;
    title?: string;
    email: string;
    phone?: string;
    isPrimary?: boolean;
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
  notes: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  contacts: ContactDraft[];
  trades: TradeDraft[];
}

const EMPTY: FormState = {
  companyName: "",
  tradingName: "",
  vendorCode: "",
  status: "active",
  paymentTerms: "",
  currency: "USD",
  vatRegistered: false,
  vatNumber: "",
  notes: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "",
  contacts: [],
  trades: [],
};

function vendorToForm(v: VendorWithRelations): FormState {
  return {
    companyName: v.company_name,
    tradingName: v.trading_name ?? "",
    vendorCode: v.vendor_code ?? "",
    status: v.status,
    paymentTerms: v.payment_terms ?? "",
    currency: v.currency ?? "USD",
    vatRegistered: v.vat_registered,
    vatNumber: v.vat_number ?? "",
    notes: v.notes ?? "",
    line1: v.address?.line1 ?? "",
    line2: v.address?.line2 ?? "",
    city: v.address?.city ?? "",
    region: v.address?.region ?? "",
    postal: v.address?.postal ?? "",
    country: v.address?.country ?? "",
    contacts: v.contacts.map((c) => ({
      name: c.name,
      title: c.title ?? "",
      email: c.email,
      phone: c.phone ?? "",
      isPrimary: c.is_primary,
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

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate when dialog opens
    setValues(editing ? vendorToForm(editing) : EMPTY);
  }, [editing, open]);

  const setField = <K extends keyof FormState>(key: K, v: FormState[K]) =>
    setValues((s) => ({ ...s, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trim = (s: string) => s.trim();
    const opt = (s: string) => (trim(s) ? trim(s) : undefined);

    const address =
      values.line1 ||
      values.line2 ||
      values.city ||
      values.region ||
      values.postal ||
      values.country
        ? {
            line1: opt(values.line1),
            line2: opt(values.line2),
            city: opt(values.city),
            region: opt(values.region),
            postal: opt(values.postal),
            country: opt(values.country),
          }
        : undefined;

    await onSubmit({
      companyName: trim(values.companyName),
      tradingName: opt(values.tradingName),
      vendorCode: opt(values.vendorCode),
      status: values.status,
      paymentTerms: opt(values.paymentTerms),
      currency: values.currency,
      vatRegistered: values.vatRegistered,
      vatNumber: opt(values.vatNumber),
      notes: opt(values.notes),
      address,
      contacts: values.contacts
        .filter((c) => c.name.trim() && c.email.trim())
        .map((c) => ({
          name: c.name.trim(),
          title: opt(c.title),
          email: c.email.trim(),
          phone: opt(c.phone),
          isPrimary: c.isPrimary,
          receivesRfq: c.receivesRfq,
        })),
      trades: values.trades
        .filter((tr): tr is TradeDraft & { categoryId: string } =>
          Boolean(tr.categoryId)
        )
        .map((tr) => ({
          categoryId: tr.categoryId,
          proficiencyLevel: tr.proficiencyLevel,
          notes: opt(tr.notes),
        })),
    });
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
              required
              maxLength={255}
            />
            <Input
              label={t("tradingName")}
              value={values.tradingName}
              onChange={(e) => setField("tradingName", e.target.value)}
              maxLength={255}
            />
            <Input
              label={t("vendorCode")}
              value={values.vendorCode}
              onChange={(e) => setField("vendorCode", e.target.value)}
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
                      {t(`status_${s}`)}
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
              maxLength={50}
              disabled={!values.vatRegistered}
            />
          </div>
          <Checkbox
            id="vat-registered"
            checked={values.vatRegistered}
            onCheckedChange={(c) => setField("vatRegistered", c)}
            label={t("vatRegistered")}
          />

          {/* Address */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-text-secondary">
              {t("address")}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder={t("addrLine1")}
                value={values.line1}
                onChange={(e) => setField("line1", e.target.value)}
                maxLength={255}
              />
              <Input
                placeholder={t("addrLine2")}
                value={values.line2}
                onChange={(e) => setField("line2", e.target.value)}
                maxLength={255}
              />
              <Input
                placeholder={t("addrCity")}
                value={values.city}
                onChange={(e) => setField("city", e.target.value)}
                maxLength={100}
              />
              <Input
                placeholder={t("addrRegion")}
                value={values.region}
                onChange={(e) => setField("region", e.target.value)}
                maxLength={100}
              />
              <Input
                placeholder={t("addrPostal")}
                value={values.postal}
                onChange={(e) => setField("postal", e.target.value)}
                maxLength={20}
              />
              <Input
                placeholder={t("addrCountry")}
                value={values.country}
                onChange={(e) => setField("country", e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

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
