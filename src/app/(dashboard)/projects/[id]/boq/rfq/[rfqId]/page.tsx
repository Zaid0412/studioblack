"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, FileText, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { useRfqDetail, useRfqMutations } from "@/hooks/useRfqs";
import { formatDate } from "@/lib/formatDate";
import { RfqStatusBadge } from "../_components/RfqStatusBadge";
import { RfqIssueDialog } from "./_components/RfqIssueDialog";
import { RfqStatusTimeline } from "./_components/RfqStatusTimeline";

/**
 * Studio RFQ detail page — header, items, invited vendors, and the
 * issue/cancel action buttons. The status timeline (audit-event driven)
 * lands in Phase E; for now the badge is the only history surface.
 */
export default function BoqRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string; rfqId: string }>;
}) {
  const { id: projectId, rfqId } = use(params);
  const t = useTranslations("rfq.detail");
  const { role } = useUserRole();
  const isPM = role === "pm";
  const canManage = role === "pm" || role === "architect";

  const { rfq, notFound, isLoading, mutate } = useRfqDetail(projectId, rfqId);
  const { issue, cancel } = useRfqMutations(projectId);

  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-10">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-start justify-between gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-72" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (notFound || !rfq) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-10">
        <Link
          href={`/projects/${projectId}/boq/rfq`}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </Link>
        <EmptyState
          icon={FileText}
          title={t("notFound")}
          description={t("notFoundHint")}
          action={{
            label: t("back"),
            href: `/projects/${projectId}/boq/rfq`,
          }}
        />
      </div>
    );
  }

  const isDraft = rfq.status === "draft";
  const isCancellable = !["cancelled", "awarded"].includes(rfq.status);

  const handleIssue = async (vendorIds: string[]) => {
    const res = await issue(rfqId, { vendorIds });
    if (res) {
      setIssueOpen(false);
      await mutate();
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await cancel(rfqId, { reason: null });
      if (res) {
        setCancelOpen(false);
        await mutate();
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-10">
      <Link
        href={`/projects/${projectId}/boq/rfq`}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back")}
      </Link>

      {/* Custom header: status badge inline with the title (PageHeader's
          `title` prop is string-only). */}
      <div className="flex items-start justify-between gap-4 pb-4 lg:pb-6">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl lg:text-2xl font-bold text-text-primary">
              {rfq.title}
            </h1>
            <RfqStatusBadge status={rfq.status} />
          </div>
          <p className="text-sm text-text-secondary">
            {rfq.rfq_number} · {formatDate(rfq.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canManage && isDraft && (
            <Button onClick={() => setIssueOpen(true)}>
              <Mail className="w-4 h-4" />
              {t("issueBtn")}
            </Button>
          )}
          {isPM && isCancellable && (
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(true)}
              className="text-error hover:text-error"
            >
              <Trash2 className="w-4 h-4" />
              {t("cancelBtn")}
            </Button>
          )}
        </div>
      </div>

      {/* Header details */}
      <section className="rounded-xl border border-border-default bg-bg-secondary p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <DetailRow
          label={t("issuedDate")}
          value={rfq.issued_date ? formatDate(rfq.issued_date) : "—"}
        />
        <DetailRow
          label={t("responseDeadline")}
          value={
            rfq.response_deadline ? formatDate(rfq.response_deadline) : "—"
          }
        />
        <DetailRow
          label={t("scope")}
          value={rfq.scope_of_work ?? "—"}
          multiline
        />
        <DetailRow
          label={t("terms")}
          value={rfq.terms_conditions ?? "—"}
          multiline
        />
      </section>

      {/* Items */}
      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("itemsHeading", { count: rfq.items.length })}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated text-text-muted">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">
                  {t("col.description")}
                </th>
                <th className="px-4 py-2.5 font-medium">{t("col.unit")}</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  {t("col.quantity")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("col.specNotes")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((it) => (
                <tr key={it.id} className="border-t border-border-default">
                  <td className="px-4 py-3 text-text-primary">
                    {it.description}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{it.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                    {it.quantity}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {it.spec_notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invited vendors */}
      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("vendorsHeading", { count: rfq.vendors.length })}
          </h2>
          {rfq.vendors.length === 0 && (
            <p className="text-xs text-text-muted mt-1">{t("vendorsEmpty")}</p>
          )}
        </div>
        {rfq.vendors.length > 0 && (
          <ul className="divide-y divide-border-default">
            {rfq.vendors.map((v) => (
              <li
                key={v.vendor_id}
                className="px-6 py-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {v.vendor_name}
                  </div>
                  {v.vendor_code && (
                    <div className="text-xs text-text-muted">
                      {v.vendor_code}
                    </div>
                  )}
                </div>
                <span className="text-xs text-text-muted shrink-0">
                  {t("invitedAt")} · {formatDate(v.invited_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity timeline — at the bottom of the page, GH/tasks-style. */}
      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("timelineHeading")}
          </h2>
        </div>
        <RfqStatusTimeline events={rfq.events} />
      </section>

      <RfqIssueDialog
        projectId={projectId}
        rfqId={rfqId}
        open={issueOpen}
        onOpenChange={setIssueOpen}
        onConfirm={handleIssue}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmDescription")}
        confirmLabel={t("cancelConfirm")}
        cancelLabel={t("keepRfq")}
        destructive
        submitting={cancelling}
        onConfirm={handleCancel}
      />
    </div>
  );

  /** Tiny inline component to keep the detail grid tidy. */
  function DetailRow({
    label,
    value,
    multiline,
  }: {
    label: string;
    value: string;
    multiline?: boolean;
  }) {
    return (
      <div
        className={`flex flex-col gap-1 ${multiline ? "md:col-span-2" : ""}`}
      >
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span
          className={`text-sm text-text-primary ${
            multiline ? "whitespace-pre-wrap" : ""
          }`}
        >
          {value}
        </span>
      </div>
    );
  }
}
