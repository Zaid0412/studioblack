"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { useBoq } from "@/hooks/useBoq";
import { useRfqMutations } from "@/hooks/useRfqs";
import { toast } from "@/components/ui/useToast";
import { toIsoDate } from "@/lib/formatDate";
import type { BoqItemWithComputed } from "@/types";
import { BoqItemsPickerTable } from "../../_components/BoqItemsPickerTable";

interface Props {
  projectId: string;
}

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
  const { boq, isLoading: boqLoading } = useBoq(projectId);
  const { create } = useRfqMutations(projectId);

  const [title, setTitle] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // RFQ-4a: only items the PM has marked Ready for Procurement and that aren't
  // already committed to an RFQ are eligible.
  const items: BoqItemWithComputed[] = useMemo(
    () =>
      (boq?.items ?? []).filter(
        (it) => it.phase === "ready_for_procurement" && it.po_status === "none"
      ),
    [boq?.items]
  );

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
              labels={{
                selectAll: t("create.selectAll"),
                code: t("create.col.code"),
                description: t("create.col.description"),
                unit: t("create.col.unit"),
                quantity: t("create.col.quantity"),
              }}
            />
          </div>
        )}
      </section>

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
