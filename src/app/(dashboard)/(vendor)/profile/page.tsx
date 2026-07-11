"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useResyncFromProp } from "@/hooks/useResyncFromProp";
import { AlertTriangle, Save, Star, X, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BankDetailsForm } from "@/components/vendors/BankDetailsForm";
import { KycDocumentList } from "@/components/vendors/KycDocumentList";
import { VendorKycStatusBadge } from "@/app/(dashboard)/vendors/_components/VendorKycStatusBadge";
import { VendorStatusBadge } from "@/app/(dashboard)/vendors/_components/VendorStatusBadge";
import {
  useVendorMe,
  useVendorMeBankDetails,
  useVendorMeKyc,
  useVendorMeContacts,
} from "@/hooks/useVendorPortalProfile";
import { cn } from "@/lib/utils";
import { useLoadStagger } from "@/hooks/useLoadStagger";
import type { VendorContact } from "@/types";

/** Vendor portal — self-service profile page. Tabs for overview, contacts, bank, and KYC. */
export default function VendorPortalProfilePage() {
  const tProfile = useTranslations("vendorPortal.profile");
  const tVendors = useTranslations("vendors");

  const { vendor, suspended, isLoading, error, mutate, save } = useVendorMe();
  const [activeTab, setActiveTab] = useState("overview");
  const revealRef = useLoadStagger<HTMLDivElement>(vendor ? "1" : "0");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-[1100px]">
        <PageHeader title={tProfile("title")} subtitle={tProfile("subtitle")} />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="flex flex-col gap-6 max-w-[1100px]">
        <PageHeader title={tProfile("title")} subtitle={tProfile("subtitle")} />
        <p className="text-sm text-error">{tProfile("loadError")}</p>
      </div>
    );
  }

  return (
    <div
      ref={revealRef}
      className="stagger-children flex flex-col gap-6 max-w-[1100px]"
    >
      <PageHeader title={tProfile("title")} subtitle={tProfile("subtitle")} />

      {suspended && (
        <div className="flex items-start gap-3 rounded-lg border border-error/40 bg-error/10 p-4">
          <AlertTriangle className="w-5 h-5 shrink-0 text-error mt-0.5" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-error">
              {tProfile("suspendedTitle")}
            </h3>
            <p className="text-sm text-text-secondary">
              {tProfile("suspendedDesc")}
            </p>
          </div>
        </div>
      )}

      {/* Header card — read-only PM-controlled fields */}
      <section className="flex flex-col gap-3 rounded-xl bg-bg-elevated p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-lg font-bold text-text-primary truncate">
              {vendor.company_name}
            </h2>
            {vendor.vendor_code && (
              <p className="text-xs text-text-muted">
                {tVendors("vendorCode")}: {vendor.vendor_code}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <VendorStatusBadge status={vendor.status} />
            <VendorKycStatusBadge status={vendor.kyc_status} />
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              {tVendors("paymentTerms")}
            </dt>
            <dd className="text-text-primary">{vendor.payment_terms ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              {tVendors("currency")}
            </dt>
            <dd className="text-text-primary">{vendor.currency}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              {tVendors("vatNumber")}
            </dt>
            <dd className="text-text-primary">{vendor.vat_number ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-4"
      >
        <TabsList className="self-start">
          <TabsTrigger value="overview">{tProfile("tabOverview")}</TabsTrigger>
          <TabsTrigger value="contacts">{tProfile("tabContacts")}</TabsTrigger>
          <TabsTrigger value="bank">{tProfile("tabBank")}</TabsTrigger>
          <TabsTrigger value="kyc">{tProfile("tabKyc")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab vendor={vendor} suspended={suspended} save={save} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-0">
          <ContactsTab
            contacts={vendor.contacts ?? []}
            suspended={suspended}
            onMutate={mutate}
          />
        </TabsContent>

        <TabsContent value="bank" className="mt-0">
          <BankTab suspended={suspended} active={activeTab === "bank"} />
        </TabsContent>

        <TabsContent value="kyc" className="mt-0">
          <KycTab
            suspended={suspended}
            active={activeTab === "kyc"}
            onVendorMutate={mutate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview ───────────────────────────────────────────────────────────────

type AddressField =
  | "line1"
  | "line2"
  | "city"
  | "region"
  | "postal"
  | "country";

const ADDRESS_FIELDS: ReadonlyArray<{
  key: AddressField;
  labelKey: string;
  maxLength: number;
}> = [
  { key: "line1", labelKey: "addressLine1", maxLength: 255 },
  { key: "line2", labelKey: "addressLine2", maxLength: 255 },
  { key: "city", labelKey: "city", maxLength: 100 },
  { key: "region", labelKey: "region", maxLength: 100 },
  { key: "postal", labelKey: "postal", maxLength: 20 },
  { key: "country", labelKey: "country", maxLength: 100 },
];

function OverviewTab({
  vendor,
  suspended,
  save,
}: {
  vendor: NonNullable<ReturnType<typeof useVendorMe>["vendor"]>;
  suspended: boolean;
  save: ReturnType<typeof useVendorMe>["save"];
}) {
  const tProfile = useTranslations("vendorPortal.profile");
  const tCommon = useTranslations("common");

  // Read the vendor's addresses array (preferred) with a one-release
  // fallback to the legacy single `address` field while the column is
  // still around. The portal currently exposes ONE address (the primary,
  // or the first one if none is marked); a follow-up will expand this
  // surface into a multi-address editor mirroring the PM-side dialog.
  const pickPrimaryAddress = (
    v: NonNullable<typeof vendor>
  ): NonNullable<typeof vendor>["address"] => {
    const list = v.addresses ?? [];
    if (list.length === 0) return v.address;
    return list.find((a) => a.is_primary) ?? list[0];
  };

  const buildAddress = (
    a: NonNullable<typeof vendor>["address"]
  ): Record<AddressField, string> => ({
    line1: (a?.line1 ?? "") as string,
    line2: (a?.line2 ?? "") as string,
    city: (a?.city ?? "") as string,
    region: (a?.region ?? "") as string,
    postal: (a?.postal ?? "") as string,
    country: (a?.country ?? "") as string,
  });

  const [tradingName, setTradingName] = useState(vendor.trading_name ?? "");
  const [address, setAddress] = useState<Record<AddressField, string>>(() =>
    buildAddress(pickPrimaryAddress(vendor))
  );
  const [submitting, setSubmitting] = useState(false);

  useResyncFromProp(
    {
      trading_name: vendor.trading_name,
      addresses: vendor.addresses,
      address: vendor.address,
    },
    (next) => {
      setTradingName(next.trading_name ?? "");
      const primary =
        next.addresses && next.addresses.length > 0
          ? (next.addresses.find((a) => a.is_primary) ?? next.addresses[0])
          : next.address;
      setAddress(buildAddress(primary));
    }
  );

  const setAddressField = (k: AddressField, v: string) =>
    setAddress((s) => ({ ...s, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cleanedAddress = Object.fromEntries(
        Object.entries(address).filter(([, v]) => v && v.trim())
      );
      const hasAddress = Object.keys(cleanedAddress).length > 0;
      await save({
        tradingName: tradingName.trim() || null,
        // The schema accepts an array. Send a single primary entry, or
        // an empty array when the user has cleared every field.
        addresses: hasAddress ? [{ ...cleanedAddress, is_primary: true }] : [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label={tProfile("tradingName")}
          value={tradingName}
          onChange={(e) => setTradingName(e.target.value)}
          maxLength={255}
          disabled={suspended}
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-input p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {tProfile("address")}
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ADDRESS_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={tProfile(field.labelKey)}
              value={address[field.key]}
              onChange={(e) => setAddressField(field.key, e.target.value)}
              maxLength={field.maxLength}
              disabled={suspended}
            />
          ))}
        </div>
      </fieldset>

      {!suspended && (
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            <Save className="w-4 h-4" />
            {submitting ? tCommon("loading") : tCommon("save")}
          </Button>
        </div>
      )}
    </form>
  );
}

// ─── Contacts ───────────────────────────────────────────────────────────────

function ContactsTab({
  contacts,
  suspended,
  onMutate,
}: {
  contacts: VendorContact[];
  suspended: boolean;
  onMutate: () => Promise<unknown>;
}) {
  const tProfile = useTranslations("vendorPortal.profile");
  const tVendors = useTranslations("vendors");
  const tCommon = useTranslations("common");

  const { addContact, updateContact, removeContact } = useVendorMeContacts(
    () => {
      void onMutate();
    }
  );

  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<VendorContact | null>(
    null
  );
  const [linkedNotice, setLinkedNotice] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {tVendors("contactsLabel")}
        </h3>
        {!suspended && !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" />
            {tVendors("addContact")}
          </Button>
        )}
      </div>

      {contacts.length === 0 && !adding ? (
        <p className="text-sm text-text-muted italic">
          {tVendors("noContacts")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              suspended={suspended}
              onPatch={(patch) => updateContact(c.id, patch)}
              onRemove={() => {
                if (c.user_id) {
                  setLinkedNotice(true);
                  return;
                }
                setConfirmDelete(c);
              }}
            />
          ))}
        </ul>
      )}

      {adding && (
        <NewContactForm
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            await addContact(input);
            setAdding(false);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={tProfile("removeContactTitle")}
        description={tProfile("removeContactDesc")}
        confirmLabel={tVendors("removeContact")}
        cancelLabel={tCommon("cancel")}
        destructive
        onConfirm={async () => {
          if (confirmDelete) await removeContact(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      <ConfirmDialog
        open={linkedNotice}
        onOpenChange={setLinkedNotice}
        title={tProfile("contactLinkedTitle")}
        description={tProfile("contactLinkedDesc")}
        confirmLabel={tCommon("close")}
        cancelLabel={tCommon("close")}
        onConfirm={() => setLinkedNotice(false)}
      />
    </div>
  );
}

function ContactRow({
  contact,
  suspended,
  onPatch,
  onRemove,
}: {
  contact: VendorContact;
  suspended: boolean;
  onPatch: (patch: {
    name?: string;
    title?: string | null;
    email?: string;
    phone?: string | null;
    isPrimary?: boolean;
    receivesRfq?: boolean;
  }) => Promise<void>;
  onRemove: () => void;
}) {
  const tVendors = useTranslations("vendors");
  const tProfile = useTranslations("vendorPortal.profile");

  const [name, setName] = useState(contact.name);
  const [title, setTitle] = useState(contact.title ?? "");
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [submitting, setSubmitting] = useState(false);

  useResyncFromProp(contact, (next) => {
    setName(next.name);
    setTitle(next.title ?? "");
    setEmail(next.email);
    setPhone(next.phone ?? "");
  });

  const dirty =
    name !== contact.name ||
    title !== (contact.title ?? "") ||
    email !== contact.email ||
    phone !== (contact.phone ?? "");

  const handleSave = async () => {
    if (!dirty || submitting) return;
    setSubmitting(true);
    try {
      await onPatch({
        name: name.trim(),
        title: title.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li
      className={cn(
        "rounded-lg border border-border-default bg-bg-input p-3 flex flex-col gap-2",
        suspended && "opacity-75"
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input
          placeholder={tVendors("contactName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          disabled={suspended}
        />
        <Input
          placeholder={tVendors("contactTitle")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          disabled={suspended}
        />
        <Input
          type="email"
          placeholder={tVendors("contactEmail")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleSave}
          disabled={suspended}
        />
        <Input
          placeholder={tVendors("contactPhone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={handleSave}
          disabled={suspended}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <button
          type="button"
          onClick={() =>
            !contact.is_primary && void onPatch({ isPrimary: true })
          }
          disabled={suspended || contact.is_primary}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs transition-colors",
            contact.is_primary
              ? "text-warning font-medium"
              : "text-text-muted hover:text-text-primary disabled:hover:text-text-muted"
          )}
          aria-pressed={contact.is_primary}
        >
          <Star
            className={cn("w-3.5 h-3.5", contact.is_primary && "fill-warning")}
          />
          {tVendors("primaryContact")}
        </button>
        <Checkbox
          id={`rfq-${contact.id}`}
          checked={!!contact.receives_rfq}
          onCheckedChange={(checked) => void onPatch({ receivesRfq: checked })}
          disabled={suspended}
          label={tVendors("receivesRfq")}
        />
        {contact.user_id && (
          <Badge variant="success">{tProfile("contactLinked")}</Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={suspended}
          className="ml-auto text-error hover:text-error"
          aria-label={tVendors("removeContact")}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </li>
  );
}

function NewContactForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: {
    name: string;
    title?: string;
    email: string;
    phone?: string;
    isPrimary?: boolean;
    receivesRfq?: boolean;
  }) => Promise<void>;
}) {
  const tVendors = useTranslations("vendors");
  const tCommon = useTranslations("common");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [receivesRfq, setReceivesRfq] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        title: title.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        receivesRfq,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-bg-input p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input
          label={tVendors("contactName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={tVendors("contactTitle")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          type="email"
          label={tVendors("contactEmail")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label={tVendors("contactPhone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Checkbox
        id="new-contact-rfq"
        checked={receivesRfq}
        onCheckedChange={setReceivesRfq}
        label={tVendors("receivesRfq")}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </div>
  );
}

// ─── Bank ───────────────────────────────────────────────────────────────────

function BankTab({
  suspended,
  active,
}: {
  suspended: boolean;
  active: boolean;
}) {
  // Only fetch (and decrypt) bank details when the tab is open.
  const { bankDetails, isLoading, error, save } =
    useVendorMeBankDetails(active);

  return (
    <BankDetailsForm
      value={bankDetails}
      isLoading={isLoading}
      error={error}
      onSave={save}
      readOnly={suspended}
    />
  );
}

// ─── KYC ────────────────────────────────────────────────────────────────────

function KycTab({
  suspended,
  active,
  onVendorMutate,
}: {
  suspended: boolean;
  active: boolean;
  onVendorMutate: () => Promise<unknown>;
}) {
  const { documents, isLoading, addDocument, removeDocument } = useVendorMeKyc(
    active,
    () => {
      void onVendorMutate();
    }
  );

  return (
    <KycDocumentList
      documents={documents}
      isLoading={isLoading}
      onAdd={async (input) => {
        await addDocument(input);
      }}
      onRemove={removeDocument}
      readOnly={suspended}
    />
  );
}
