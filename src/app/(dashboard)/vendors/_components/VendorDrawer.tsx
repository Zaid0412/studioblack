"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Mail,
  Phone,
  Star,
  Edit3,
  Trash2,
  Tag,
  ShieldCheck,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/useToast";
import { vendors as vendorsApi } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useVendor } from "@/hooks/useVendors";
import type { VendorWithRelations } from "@/types";
import { useUserRole } from "@/hooks/useUserRole";
import { useFlag } from "@/hooks/useFlag";
import { VendorStatusBadge } from "./VendorStatusBadge";
import { VendorKycStatusDot } from "./VendorKycStatusBadge";
import { VendorRatingPicker } from "./VendorRatingPicker";
import { VendorBankDetailsForm } from "./VendorBankDetailsForm";
import { VendorKycTab } from "./VendorKycTab";

interface Props {
  vendorId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (vendor: VendorWithRelations) => void;
  onSoftDelete: (id: string) => Promise<void> | void;
  onHardDelete: (id: string) => Promise<void> | void;
  onRatingChange: (id: string, rating: number) => Promise<void> | void;
}

/**
 * Slide-out detail panel for a vendor.
 *
 * Tabs:
 *  - Overview: identity, address, notes, rating
 *  - Contacts: read-only list (edit happens in the form dialog)
 *  - Trades: chips of mapped element categories
 *  - Bank: PM-only — lazy-loads encrypted details on tab activation
 */
export function VendorDrawer({
  vendorId,
  onOpenChange,
  onEdit,
  onSoftDelete,
  onHardDelete,
  onRatingChange,
}: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");
  const { role } = useUserRole();
  const isPm = role === "pm";
  const vendorPortalEnabled = useFlag("vendorPortal");

  const { vendor, isLoading, mutate: mutateVendor } = useVendor(vendorId);

  const [activeTab, setActiveTab] = useState("overview");
  const [confirmSoft, setConfirmSoft] = useState(false);
  const [confirmHard, setConfirmHard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invitingContactId, setInvitingContactId] = useState<string | null>(
    null
  );

  const handleInviteContact = async (contactId: string, email: string) => {
    if (!vendorId) return;
    setInvitingContactId(contactId);
    try {
      const result = await vendorsApi.inviteContact(vendorId, contactId);
      if (result.status === "linked") {
        toast({
          title: t("portalLinked"),
          description: t("portalLinkedDescription", { email }),
          variant: "success",
        });
      } else {
        toast({
          title: t("inviteSent"),
          description: t("inviteSentDescription", { email }),
          variant: "success",
        });
      }
      await mutateVendor();
    } catch (err) {
      toast({
        title: tCommon("error"),
        description: err instanceof Error ? err.message : t("inviteError"),
        variant: "error",
      });
    } finally {
      setInvitingContactId(null);
    }
  };

  const open = vendorId !== null;

  const handleSoft = async () => {
    if (!vendorId) return;
    setBusy(true);
    try {
      await onSoftDelete(vendorId);
      setConfirmSoft(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleHard = async () => {
    if (!vendorId) return;
    setBusy(true);
    try {
      await onHardDelete(vendorId);
      setConfirmHard(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) setActiveTab("overview");
          onOpenChange(o);
        }}
      >
        <SheetContent>
          {isLoading || !vendor ? (
            <DrawerSkeleton />
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="flex flex-col gap-1 min-w-0">
                    <SheetTitle className="truncate">
                      {vendor.company_name}
                    </SheetTitle>
                    {vendor.trading_name && (
                      <SheetDescription>{vendor.trading_name}</SheetDescription>
                    )}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <VendorStatusBadge status={vendor.status} />
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                        <VendorKycStatusDot status={vendor.kyc_status} />
                        {t(`kycStatus_${vendor.kyc_status}`)}
                      </span>
                      {vendor.vendor_code && (
                        <span className="font-mono text-xs text-text-muted">
                          {vendor.vendor_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEdit(vendor)}
                  >
                    <Edit3 className="w-4 h-4" />
                    {tCommon("edit")}
                  </Button>
                </div>
              </SheetHeader>

              <SheetBody>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="overview">
                      {t("tabOverview")}
                    </TabsTrigger>
                    <TabsTrigger value="contacts">
                      {t("tabContacts")} ({vendor.contacts.length})
                    </TabsTrigger>
                    <TabsTrigger value="trades">
                      {t("tabTrades")} ({vendor.trades.length})
                    </TabsTrigger>
                    <TabsTrigger value="kyc">{t("tabKyc")}</TabsTrigger>
                    {isPm && (
                      <TabsTrigger value="bank">{t("tabBank")}</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent
                    value="overview"
                    className="flex flex-col gap-5 mt-4"
                  >
                    <section className="flex flex-col gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        {t("rating")}
                      </h4>
                      <VendorRatingPicker
                        value={Number(vendor.rating ?? 0)}
                        onChange={(r) => onRatingChange(vendor.id, r)}
                      />
                    </section>

                    <section className="grid grid-cols-2 gap-3">
                      <Field label={t("currency")} value={vendor.currency} />
                      <Field
                        label={t("paymentTerms")}
                        value={vendor.payment_terms ?? "—"}
                      />
                      <Field
                        label={t("vatRegistered")}
                        value={vendor.vat_registered ? tCommon("confirm") : "—"}
                      />
                      <Field
                        label={t("vatNumber")}
                        value={vendor.vat_number ?? "—"}
                      />
                    </section>

                    {(() => {
                      // Prefer the new addresses[] column; fall back to the
                      // legacy single `address` until the migration drops it.
                      const list =
                        vendor.addresses && vendor.addresses.length > 0
                          ? vendor.addresses
                          : vendor.address
                            ? [vendor.address]
                            : [];
                      const visible = list.filter((a) =>
                        Object.entries(a).some(
                          ([k, v]) =>
                            k !== "is_primary" && k !== "label" && Boolean(v)
                        )
                      );
                      if (visible.length === 0) return null;
                      return (
                        <section className="flex flex-col gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                            {t("addressesLabel")}
                          </h4>
                          {visible.map((a, i) => (
                            <div
                              key={i}
                              className="flex flex-col gap-0.5 rounded-md border border-border-default bg-bg-input p-2"
                            >
                              {(a.label || a.is_primary) && (
                                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                                  {a.label && <span>{a.label}</span>}
                                  {a.is_primary && (
                                    <span className="text-warning">
                                      {t("primaryAddress")}
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className="text-sm text-text-primary whitespace-pre-line">
                                {[
                                  a.line1,
                                  a.line2,
                                  [a.city, a.region].filter(Boolean).join(", "),
                                  [a.postal, a.country]
                                    .filter(Boolean)
                                    .join(" "),
                                ]
                                  .filter(Boolean)
                                  .join("\n")}
                              </p>
                            </div>
                          ))}
                        </section>
                      );
                    })()}

                    {vendor.notes && (
                      <section className="flex flex-col gap-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {t("notes")}
                        </h4>
                        <p className="text-sm text-text-primary whitespace-pre-line">
                          {vendor.notes}
                        </p>
                      </section>
                    )}

                    {isPm && (
                      <section className="flex flex-col gap-2 pt-3 border-t border-border-default">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {t("dangerZone")}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {vendor.status !== "inactive" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmSoft(true)}
                            >
                              <Trash2 className="w-4 h-4" />
                              {t("markInactive")}
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setConfirmHard(true)}
                          >
                            <Trash2 className="w-4 h-4" />
                            {t("deletePermanent")}
                          </Button>
                        </div>
                      </section>
                    )}
                  </TabsContent>

                  <TabsContent value="contacts" className="mt-4">
                    {vendor.contacts.length === 0 ? (
                      <p className="text-sm text-text-muted italic">
                        {t("noContacts")}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {vendor.contacts.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-lg border border-border-default bg-bg-input p-3 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {c.name}
                                </span>
                                {c.is_primary && (
                                  <Badge variant="warning" className="shrink-0">
                                    <Star className="w-3 h-3 mr-1" />
                                    {t("primary")}
                                  </Badge>
                                )}
                                {c.user_id && (
                                  <Badge variant="active" className="shrink-0">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {t("portalLinked")}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {!c.receives_rfq && (
                                  <Badge variant="archived">
                                    {t("rfqOptOut")}
                                  </Badge>
                                )}
                                {isPm && vendorPortalEnabled && !c.user_id && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={invitingContactId === c.id}
                                    onClick={() =>
                                      handleInviteContact(c.id, c.email)
                                    }
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    {invitingContactId === c.id
                                      ? tCommon("loading")
                                      : t("inviteToPortal")}
                                  </Button>
                                )}
                              </div>
                            </div>
                            {c.title && (
                              <p className="text-xs text-text-muted">
                                {c.title}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                              <a
                                href={`mailto:${c.email}`}
                                className="inline-flex items-center gap-1 hover:text-accent"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                {c.email}
                              </a>
                              {c.phone && (
                                <a
                                  href={`tel:${c.phone}`}
                                  className="inline-flex items-center gap-1 hover:text-accent"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  {c.phone}
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="trades" className="mt-4">
                    {vendor.trades.length === 0 ? (
                      <p className="text-sm text-text-muted italic">
                        {t("noTrades")}
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {vendor.trades.map((tr) => (
                          <li
                            key={tr.id}
                            className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-input px-3 py-1.5 text-xs"
                            style={
                              tr.category_color
                                ? { borderColor: tr.category_color }
                                : undefined
                            }
                          >
                            <Tag className="w-3 h-3 text-text-muted" />
                            <span className="text-text-primary">
                              {tr.category_name}
                            </span>
                            <span className="text-text-muted">
                              · {t(`proficiency_${tr.proficiency_level}`)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="kyc">
                    <VendorKycTab
                      vendor={vendor}
                      enabled={activeTab === "kyc"}
                      onVendorMutate={() => mutateVendor()}
                    />
                  </TabsContent>

                  {isPm && (
                    <TabsContent value="bank" className="mt-4">
                      <div className="flex items-center gap-2 mb-3 text-xs text-text-muted">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t("bankAuditNote")}</span>
                      </div>
                      <VendorBankDetailsForm
                        vendorId={vendor.id}
                        enabled={activeTab === "bank"}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmSoft}
        onOpenChange={setConfirmSoft}
        title={t("confirmSoftTitle")}
        description={t("confirmSoftDesc")}
        confirmLabel={t("markInactive")}
        cancelLabel={tCommon("cancel")}
        submitting={busy}
        onConfirm={handleSoft}
      />
      <ConfirmDialog
        open={confirmHard}
        onOpenChange={setConfirmHard}
        title={t("confirmHardTitle")}
        description={t("confirmHardDesc")}
        confirmLabel={t("deletePermanent")}
        cancelLabel={tCommon("cancel")}
        destructive
        submitting={busy}
        onConfirm={handleHard}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
