"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, BadgeCheck, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { useBoq } from "@/hooks/useBoq";
import { useRfqMutations } from "@/hooks/useRfqs";
import { toast } from "@/components/ui/useToast";
import { toIsoDate } from "@/lib/formatDate";
import {
  RFQ_ELIGIBLE_PHASES,
  RFQ_PACKAGE_TYPES,
  type RfqPackageType,
} from "@/lib/validations";
import { RFQ_PACKAGE_TYPE_ICONS } from "@/lib/rfqLabels";
import { rateContracts as rateContractsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type { AvailableRate, BoqItemWithComputed } from "@/types";
import { BoqItemsPickerTable } from "../../_components/BoqItemsPickerTable";
import { BoqApplyRateDialog } from "../../../../boq/_components/BoqApplyRateDialog";

interface Props {
  projectId: string;
}

const EMPTY_AVAILABILITY: Record<string, AvailableRate | null> = {};

/**
 * Single-page RFQ creator. Title is required; at least one BOQ item must be
 * picked. The RFQ items inherit `description / unit / quantity` from the
 * BOQ item — the future detail page will let the PM tweak them per-RFQ.
 *
 * Server is the source of truth: it rejects invalid BOQ ids inside the
 * createRfqDraft transaction, so we don't pre-validate ownership client-side.
 */
export function RfqCreateForm({ projectId }: Props) {
  const t = useTranslations("rfq");
  const router = useRouter();
  const { boq, isLoading: boqLoading, mutate: mutateBoq } = useBoq(projectId);
  const { create } = useRfqMutations(projectId);

  const [title, setTitle] = useState("");
  const [packageType, setPackageType] = useState<RfqPackageType | "">("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [applyRateItem, setApplyRateItem] =
    useState<BoqItemWithComputed | null>(null);

  // RFQ-4a: only items the PM has marked Ready for Procurement and that aren't
  // already committed to an RFQ are eligible.
  const items: BoqItemWithComputed[] = useMemo(
    () =>
      (boq?.items ?? []).filter(
        (it) =>
          RFQ_ELIGIBLE_PHASES.includes(it.phase) && it.po_status === "none"
      ),
    [boq?.items]
  );

  // PR C: flag eligible items that already have an active matching rate
  // contract, so the PM can procure via contract instead of requesting a quote.
  const elementIds = useMemo(
    () =>
      [
        ...new Set(
          items
            .map((it) => it.element_id)
            .filter((id): id is string => id !== null)
        ),
      ].sort(),
    [items]
  );
  const elementIdsKey = elementIds.join(",");

  // Keyed on the sorted element-id set (not the array ref) so a BOQ refetch
  // that returns the same elements — in any order — doesn't refire. Non-fatal
  // on error: the hints just won't show.
  const { data: rateData } = useSWR(
    elementIds.length
      ? [API.boqRateAvailability(projectId), elementIdsKey]
      : null,
    () =>
      rateContractsApi
        .getRateAvailability(projectId, elementIds)
        .then((res) => res.availability)
  );
  const rateAvailability = rateData ?? EMPTY_AVAILABILITY;

  const availableCount = useMemo(
    () =>
      items.filter((it) => it.element_id && rateAvailability[it.element_id])
        .length,
    [items, rateAvailability]
  );

  // "Use contract" applied a rate: the item's price changed so it reopens to
  // sent_to_client server-side — drop it from the selection and refetch so it
  // leaves the eligible list.
  const handleContractApplied = () => {
    if (applyRateItem) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(applyRateItem.id);
        return next;
      });
    }
    void mutateBoq();
  };

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))
    );
  };

  const canSubmit = title.trim().length > 0 && selected.size > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (title.trim().length === 0) {
        toast({ title: t("create.titleRequired"), variant: "warning" });
      } else if (selected.size === 0) {
        toast({ title: t("create.minItemsError"), variant: "warning" });
      }
      return;
    }

    setSubmitting(true);
    const itemPayload = items
      .filter((it) => selected.has(it.id))
      .map((it) => ({
        boqItemId: it.id,
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        specNotes: null,
      }));

    const rfq = await create({
      title: title.trim(),
      packageType: packageType || null,
      scopeOfWork: scopeOfWork.trim() || null,
      termsConditions: termsConditions.trim() || null,
      responseDeadline: deadline ? toIsoDate(deadline) : null,
      items: itemPayload,
    });
    setSubmitting(false);
    if (rfq) {
      toast({ title: t("create.successToast"), variant: "success" });
      router.push(`/projects/${projectId}/order/rfq`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 p-4 lg:p-10 min-h-[calc(100vh-7rem)]"
    >
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${projectId}/order/rfq`}
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label={t("create.back")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <PageHeader title={t("create.title")} subtitle={t("create.subtitle")} />
      </div>

      <section className="rounded-xl border border-border-default bg-bg-secondary p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-primary">
          {t("create.headerFields")}
        </h2>

        <Input
          label={t("create.titleField")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={255}
          placeholder={t("create.titlePlaceholder")}
        />

        <LabeledSelect
          label={t("create.packageTypeField")}
          value={packageType}
          onChange={(v) => setPackageType(v as RfqPackageType)}
          options={RFQ_PACKAGE_TYPES.map((pt) => ({
            value: pt,
            label: t(`packageType.${pt}`),
            icon: RFQ_PACKAGE_TYPE_ICONS[pt],
          }))}
          placeholder={t("create.packageTypePlaceholder")}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-text-secondary">
            {t("create.scopeField")}
          </label>
          <textarea
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            rows={3}
            placeholder={t("create.scopePlaceholder")}
            className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y min-h-[80px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-text-secondary">
            {t("create.termsField")}
          </label>
          <textarea
            value={termsConditions}
            onChange={(e) => setTermsConditions(e.target.value)}
            rows={3}
            placeholder={t("create.termsPlaceholder")}
            className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y min-h-[80px]"
          />
        </div>

        <DatePicker
          label={t("create.deadlineField")}
          value={deadline}
          onChange={setDeadline}
          placeholder={t("create.deadlinePlaceholder")}
          className="max-w-xs"
        />
      </section>

      <section className="rounded-xl border border-border-default bg-bg-secondary">
        <div className="p-6 pb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {t("create.itemsHeading")}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              {t("create.itemsSelectedCount", {
                selected: selected.size,
                total: items.length,
              })}
            </p>
          </div>
          {items.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
              {selected.size === items.length
                ? t("create.deselectAll")
                : t("create.selectAll")}
            </Button>
          )}
        </div>

        {!boqLoading && availableCount > 0 && (
          <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-4 py-2.5 text-sm text-text-secondary">
            <BadgeCheck className="w-4 h-4 text-info shrink-0" />
            <span>
              {t("create.rateContractBanner", { count: availableCount })}
            </span>
          </div>
        )}

        {boqLoading ? (
          <p className="px-6 py-8 text-sm text-text-muted">
            {t("create.loadingBoq")}
          </p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("create.noBoq")}
            description={t("create.noBoqHint")}
            action={{
              label: t("create.goToBoq"),
              href: `/projects/${projectId}/boq/my-scope`,
            }}
          />
        ) : (
          <div className="overflow-x-auto border-t border-border-default">
            <BoqItemsPickerTable
              items={items}
              selected={selected}
              onToggleItem={toggleItem}
              onToggleAll={toggleAll}
              rateAvailability={rateAvailability}
              onUseContract={setApplyRateItem}
              labels={{
                selectAll: t("create.selectAll"),
                code: t("create.col.code"),
                description: t("create.col.description"),
                unit: t("create.col.unit"),
                quantity: t("create.col.quantity"),
                rateContract: t("create.col.rateContract"),
                useContract: t("create.useContract"),
              }}
            />
          </div>
        )}
      </section>

      <BoqApplyRateDialog
        projectId={projectId}
        item={applyRateItem}
        onOpenChange={(open) => {
          if (!open) setApplyRateItem(null);
        }}
        onApplied={handleContractApplied}
      />

      <div className="flex items-center justify-end gap-3 mt-auto pt-4 border-t border-border-default -mx-4 lg:-mx-10 px-4 lg:px-10">
        <Link href={`/projects/${projectId}/order/rfq`}>
          <Button type="button" variant="ghost">
            {t("create.cancel")}
          </Button>
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("create.save")}
        </Button>
      </div>
    </form>
  );
}
