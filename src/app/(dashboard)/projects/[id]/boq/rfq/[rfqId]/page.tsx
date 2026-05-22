"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  FileText,
  Mail,
  Pencil,
  Plus,
  Trash2,
  UserPlus2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { useRfqLastViewed } from "@/hooks/useRfqLastViewed";
import { useRfqDetail, useRfqMutations } from "@/hooks/useRfqs";
import {
  useAwardRfq,
  useQuoteComparison,
  useQuotesForRfq,
} from "@/hooks/useQuotes";
import { formatDate } from "@/lib/formatDate";
import {
  QUOTE_AWARDABLE_RFQ_STATUSES,
  RFQ_INVITEABLE_STATUSES,
  RFQ_TERMINAL_STATUSES,
} from "@/lib/validations";
import { RfqDetailRow } from "../_components/RfqDetailRow";
import { RfqStatusBadge } from "../_components/RfqStatusBadge";
import { RfqAddItemsDialog } from "./_components/RfqAddItemsDialog";
import { RfqEditDialog } from "./_components/RfqEditDialog";
import { RfqIssueDialog } from "./_components/RfqIssueDialog";
import { RfqStatusTimeline } from "./_components/RfqStatusTimeline";
import { RfqQuotesSection } from "./_components/RfqQuotesSection";
import { QuoteAwardDialog } from "./_components/QuoteAwardDialog";

/**
 * Studio RFQ detail page — header (title + status badge + actions),
 * scope/terms card, items table, invited-vendors list, and the
 * audit-event-driven Activity timeline at the bottom.
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

  const lastViewedAt = useRfqLastViewed(rfqId);
  const { rfq, notFound, isLoading, mutate } = useRfqDetail(projectId, rfqId);
  // `addItems` is called inside RfqAddItemsDialog, not directly here.
  const { issue, invite, removeItem, cancel } = useRfqMutations(projectId);
  const { quotes } = useQuotesForRfq(projectId, rfqId);
  const { comparison } = useQuoteComparison(projectId, rfqId);
  const { awardSingle, awardSplit } = useAwardRfq(projectId, rfqId);

  const [issueOpen, setIssueOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);
  const [preselectedQuoteId, setPreselectedQuoteId] = useState<
    string | undefined
  >();

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
  const canInviteMore = (RFQ_INVITEABLE_STATUSES as readonly string[]).includes(
    rfq.status
  );
  const isTerminal = (RFQ_TERMINAL_STATUSES as readonly string[]).includes(
    rfq.status
  );
  const canAward =
    (QUOTE_AWARDABLE_RFQ_STATUSES as readonly string[]).includes(rfq.status) &&
    quotes.some((q) => q.status !== "expired");
  // Edit + Cancel are both gated on non-terminal status. Edits post-issue
  // are intentional (typo fixes / deadline extensions); a warning banner
  // inside the edit dialog tells the PM vendors will see the change.
  const isEditable = !isTerminal;
  const isCancellable = !isTerminal;

  const handleIssue = async (vendorIds: string[]) => {
    const res = await issue(rfqId, { vendorIds });
    if (res) {
      setIssueOpen(false);
      await mutate();
    }
  };

  const handleInvite = async (vendorIds: string[]) => {
    const res = await invite(rfqId, { vendorIds });
    if (res) {
      setInviteOpen(false);
      await mutate();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setRemovingItemId(itemId);
    const ok = await removeItem(rfqId, itemId);
    setRemovingItemId(null);
    if (ok) await mutate();
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
          {canManage && isEditable && (
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" />
              {t("editBtn")}
            </Button>
          )}
          {canManage && isDraft && (
            <Button onClick={() => setIssueOpen(true)}>
              <Mail className="w-4 h-4" />
              {t("issueBtn")}
            </Button>
          )}
          {canManage && canInviteMore && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus2 className="w-4 h-4" />
              {t("inviteMoreBtn")}
            </Button>
          )}
          {isPM && canAward && (
            <Button
              onClick={() => {
                setPreselectedQuoteId(undefined);
                setAwardOpen(true);
              }}
              className="cursor-pointer"
            >
              Award
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
        <RfqDetailRow
          label={t("issuedDate")}
          value={rfq.issued_date ? formatDate(rfq.issued_date) : "—"}
        />
        <RfqDetailRow
          label={t("responseDeadline")}
          value={
            rfq.response_deadline ? formatDate(rfq.response_deadline) : "—"
          }
        />
        <RfqDetailRow
          label={t("scope")}
          value={rfq.scope_of_work ?? "—"}
          multiline
        />
        <RfqDetailRow
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
          {canManage && isDraft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddItemsOpen(true)}
            >
              <Plus className="w-4 h-4" />
              {t("addItemsBtn")}
            </Button>
          )}
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
                {canManage && isDraft && <th className="px-4 py-2.5 w-10" />}
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
                  {canManage && isDraft && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        disabled={removingItemId === it.id}
                        aria-label={t("removeItem")}
                        className="text-text-muted hover:text-error transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quotes received */}
      {!isDraft && (
        <RfqQuotesSection
          projectId={projectId}
          rfqId={rfqId}
          quotes={quotes}
          invitedCount={rfq.vendors.length}
          canAward={canAward}
          isPM={isPM}
          lastViewedAt={lastViewedAt}
          onAwardClick={(quoteId) => {
            setPreselectedQuoteId(quoteId);
            setAwardOpen(true);
          }}
        />
      )}

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

      <RfqIssueDialog
        projectId={projectId}
        rfqId={rfqId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onConfirm={handleInvite}
        mode="invite"
      />

      <RfqEditDialog
        projectId={projectId}
        rfq={rfq}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => mutate()}
      />

      <RfqAddItemsDialog
        projectId={projectId}
        rfqId={rfqId}
        excludeBoqItemIds={rfq.items.map((it) => it.boq_item_id)}
        open={addItemsOpen}
        onOpenChange={setAddItemsOpen}
        onSaved={() => mutate()}
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

      <QuoteAwardDialog
        rfqTitle={rfq.title}
        rfqNumber={rfq.rfq_number}
        quotes={quotes}
        comparison={comparison}
        preselectedQuoteId={preselectedQuoteId}
        open={awardOpen}
        onOpenChange={setAwardOpen}
        onAwardSingle={async (quoteId) => {
          await awardSingle({ quoteId });
          await mutate();
        }}
        onAwardSplit={async (awards) => {
          await awardSplit({ awards });
          await mutate();
        }}
      />
    </div>
  );
}
