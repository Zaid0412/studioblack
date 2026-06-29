"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Edit3,
  Plus,
  ShieldCheck,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { rateContracts as rcApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { useUserRole } from "@/hooks/useUserRole";
import { useFlag } from "@/hooks/useFlag";
import type { RateContractWithDetails } from "@/types";
import type { ElementUnit } from "@/lib/validations";
import { formatDate } from "@/lib/formatDate";
import { RateContractStatusBadge } from "@/components/rate-contracts/RateContractStatusBadge";
import { RateContractItemTable } from "../_components/RateContractItemTable";
import {
  RateContractItemPicker,
  type RateContractItemDraftSubmit,
} from "../_components/RateContractItemPicker";
import { RateContractFormDialog } from "../_components/RateContractFormDialog";

interface Props {
  params: Promise<{ id: string }>;
}

/** Detail page for a rate contract — header summary, status actions, and the line-item table. */
export default function RateContractDetailPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations("rateContracts");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { role } = useUserRole();
  const canManage = role === "pm" || role === "architect";
  const rateContractsEnabled = useFlag("rateContracts");

  const { data, isLoading, mutate } = useSWR<RateContractWithDetails>(
    rateContractsEnabled ? API.rateContract(id) : null
  );

  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keys already in the contract — `el:<id>` for element overrides,
  // `area:<id>` for service-area rates. Disables dup picks in the picker.
  const existingKeys = useMemo(
    () =>
      new Set(
        (data?.items ?? []).map((i) =>
          i.element_id ? `el:${i.element_id}` : `area:${i.category_id}`
        )
      ),
    [data]
  );

  if (!rateContractsEnabled) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("title")} />
        <p className="text-sm text-text-muted italic">{t("featureDisabled")}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleActivate = async () => {
    setBusy(true);
    try {
      await rcApi.activate(data.id);
      toast({ title: t("toastActivated") });
      mutate();
      setConfirmActivate(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to activate";
      toast({ title: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await rcApi.cancel(data.id);
      toast({ title: t("toastCancelled") });
      setConfirmCancel(false);
      router.push("/elements/rate-contracts");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel";
      toast({ title: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleAddItems = async (items: RateContractItemDraftSubmit[]) => {
    try {
      await rcApi.addItems(data.id, { items });
      toast({ title: t("toastItemsAdded", { count: items.length }) });
      mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add items";
      toast({ title: msg, variant: "error" });
      throw err;
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await rcApi.removeItem(data.id, itemId);
      toast({ title: t("toastItemRemoved") });
      mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove item";
      toast({ title: msg, variant: "error" });
    }
  };

  const handleEditRate = async (
    item: { category_id: string; element_id: string | null; unit: string },
    newRate: number
  ) => {
    try {
      await rcApi.addItems(data.id, {
        items: [
          {
            categoryId: item.category_id,
            ...(item.element_id ? { elementId: item.element_id } : {}),
            unit: item.unit as ElementUnit,
            rate: newRate,
          },
        ],
      });
      toast({ title: t("toastRateUpdated") });
      mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update rate";
      toast({ title: msg, variant: "error" });
      throw err;
    }
  };

  const isDraft = data.status === "draft";
  const isActive = data.status === "active";
  const isClosed = data.status === "expired" || data.status === "cancelled";

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <Link
        href="/elements/rate-contracts"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("backToList")}
      </Link>

      <PageHeader
        title={`${data.contract_number} — ${data.name}`}
        subtitle={data.vendor_name}
        actions={
          canManage && (
            <>
              {!isClosed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit3 className="w-4 h-4" />
                  {tCommon("edit")}
                </Button>
              )}
              {isDraft && (
                <Button
                  size="sm"
                  onClick={() => setConfirmActivate(true)}
                  disabled={data.items.length === 0}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t("activate")}
                </Button>
              )}
              {isActive && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmCancel(true)}
                >
                  <XCircle className="w-4 h-4" />
                  {t("cancel")}
                </Button>
              )}
            </>
          )
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-lg border border-border-default bg-bg-secondary p-4">
        <Field label={t("status")}>
          <RateContractStatusBadge status={data.status} />
        </Field>
        <Field label={t("currency")}>
          <span className="text-sm text-text-primary">{data.currency}</span>
        </Field>
        <Field label={t("startDate")}>
          <span className="text-sm text-text-primary">
            {formatDate(data.start_date)}
          </span>
        </Field>
        <Field label={t("endDate")}>
          <span className="text-sm text-text-primary">
            {formatDate(data.end_date)}
          </span>
        </Field>
        {data.payment_terms && (
          <Field label={t("paymentTerms")}>
            <span className="text-sm text-text-primary">
              {data.payment_terms}
            </span>
          </Field>
        )}
        {data.agreement_signed_date && (
          <Field label={t("agreementSignedDate")}>
            <span className="text-sm text-text-primary">
              {formatDate(data.agreement_signed_date)}
            </span>
          </Field>
        )}
        {data.agreement_url && (
          <Field label={t("agreementFile")}>
            <a
              href={data.agreement_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {t("openAgreement")}
              <ExternalLink className="w-3 h-3" />
            </a>
          </Field>
        )}
      </section>

      {(data.terms_and_conditions || data.notes) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.terms_and_conditions && (
            <div className="rounded-lg border border-border-default p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                {t("termsAndConditions")}
              </h4>
              <p className="text-sm text-text-primary whitespace-pre-line">
                {data.terms_and_conditions}
              </p>
            </div>
          )}
          {data.notes && (
            <div className="rounded-lg border border-border-default p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                {t("notes")}
              </h4>
              <p className="text-sm text-text-primary whitespace-pre-line">
                {data.notes}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {t("itemsHeader", { count: data.items.length })}
          </h3>
          {canManage && !isClosed && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="w-4 h-4" />
              {t("addItems")}
            </Button>
          )}
        </div>
        <RateContractItemTable
          items={data.items}
          currency={data.currency}
          canRemove={canManage && !isClosed}
          canEditRate={canManage && isDraft}
          onRemove={(it) => handleRemoveItem(it.id)}
          onEditRate={handleEditRate}
        />
      </section>

      <RateContractFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={data}
        onSaved={() => mutate()}
      />

      <RateContractItemPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractCurrency={data.currency}
        existingKeys={existingKeys}
        onSubmit={handleAddItems}
      />

      <ConfirmDialog
        open={confirmActivate}
        onOpenChange={setConfirmActivate}
        title={t("confirmActivateTitle")}
        description={t("confirmActivateDesc")}
        confirmLabel={t("activate")}
        cancelLabel={tCommon("cancel")}
        submitting={busy}
        onConfirm={handleActivate}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("confirmCancelTitle")}
        description={t("confirmCancelDesc")}
        confirmLabel={t("cancel")}
        cancelLabel={tCommon("close")}
        destructive
        submitting={busy}
        onConfirm={handleCancel}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
