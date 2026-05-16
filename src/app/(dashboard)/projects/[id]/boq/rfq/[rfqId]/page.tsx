"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Mail, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useRfqDetail, useRfqMutations } from "@/hooks/useRfqs";
import { formatDate } from "@/lib/formatDate";
import { RfqStatusBadge } from "../_components/RfqStatusBadge";
import { RfqIssueDialog } from "./_components/RfqIssueDialog";

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
      <div className="p-4 lg:p-10 text-sm text-text-muted">{t("loading")}</div>
    );
  }
  if (notFound || !rfq) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-10">
        <Link
          href={`/projects/${projectId}/boq/rfq`}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </Link>
        <p className="text-sm text-text-muted">{t("notFound")}</p>
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

      <PageHeader
        title={rfq.title}
        subtitle={`${rfq.rfq_number} · ${formatDate(rfq.created_at)}`}
        actions={
          <>
            <RfqStatusBadge status={rfq.status} />
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
          </>
        }
      />

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
