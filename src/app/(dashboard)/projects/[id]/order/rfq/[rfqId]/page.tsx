"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  UserPlus2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useRfqLastViewed } from "@/hooks/useRfqLastViewed";
import { useRfqDetail, useRfqMutations } from "@/hooks/useRfqs";
import {
  useAwardRfq,
  useQuoteComparison,
  useQuotesForRfq,
} from "@/hooks/useQuotes";
import { quotes as quotesApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { formatDate } from "@/lib/formatDate";
import {
  isAwardableQuote,
  QUOTE_AWARDABLE_RFQ_STATUSES,
  QUOTE_SUBMITTABLE_RFQ_STATUSES,
  RFQ_INVITEABLE_STATUSES,
  RFQ_REVISABLE_STATUSES,
  RFQ_TERMINAL_STATUSES,
} from "@/lib/validations";
import { RfqDetailRow } from "@/components/rfq/RfqDetailRow";
import { RfqItemsTable } from "@/components/rfq/RfqItemsTable";
import { RfqItemAttachmentsDialog } from "./_components/RfqItemAttachmentsDialog";
import { RfqLogCommunicationDialog } from "./_components/RfqLogCommunicationDialog";
import { RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";
import { RfqRevisionBadge } from "@/components/rfq/RfqRevisionBadge";
import { DistributionMethodBadge } from "@/components/rfq/DistributionMethodBadge";
import { DeclineQuoteDialog } from "@/components/rfq/DeclineQuoteDialog";
import { RfqAddItemsDialog } from "./_components/RfqAddItemsDialog";
import { RfqEditDialog } from "./_components/RfqEditDialog";
import { RfqIssueDialog } from "./_components/RfqIssueDialog";
import { RfqStatusTimeline } from "@/components/rfq/RfqStatusTimeline";
import { RfqQuotesSection } from "./_components/RfqQuotesSection";
import { QuoteAwardDialog } from "./_components/QuoteAwardDialog";
import { ManualQuoteDialog } from "./_components/ManualQuoteDialog";

/**
 * Studio RFQ detail page — header (title + status badge + actions),
 * scope/terms card, items table, invited-vendors list, and the
 * audit-event-driven Activity timeline at the bottom.
 */
export default function OrderRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string; rfqId: string }>;
}) {
  const { id: projectId, rfqId } = use(params);
  const router = useRouter();
  const t = useTranslations("rfq.detail");
  const tRfq = useTranslations("rfq");
  const { role } = useUserRole();
  const isPM = role === "pm";
  const canManage = role === "pm" || role === "architect";

  const lastViewedAt = useRfqLastViewed(rfqId);
  const { rfq, notFound, isLoading, mutate } = useRfqDetail(projectId, rfqId);
  // `addItems` is called inside RfqAddItemsDialog, not directly here.
  const { issue, invite, removeItem, cancel, revise, syncBoq } =
    useRfqMutations(projectId);
  const { quotes, mutate: mutateQuotes } = useQuotesForRfq(projectId, rfqId);
  const { comparison, mutate: mutateComparison } = useQuoteComparison(
    projectId,
    rfqId
  );
  const { awardSingle, awardSplit } = useAwardRfq(projectId, rfqId);

  const [issueOpen, setIssueOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseReason, setReviseReason] = useState("");
  const [syncingBoq, setSyncingBoq] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [attachmentTarget, setAttachmentTarget] = useState<{
    id: string;
    description: string;
    attachments?: { url: string; fileName: string }[];
  } | null>(null);
  const [logCommOpen, setLogCommOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [manualQuoteOpen, setManualQuoteOpen] = useState(false);
  const [manualQuoteVendorId, setManualQuoteVendorId] = useState<string | null>(
    null
  );
  const [preselectedQuoteId, setPreselectedQuoteId] = useState<
    string | undefined
  >();
  const [declineVendor, setDeclineVendor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Stable ref so the issue dialog's seed effect doesn't re-fire every render.
  // For a revision this carries the copied vendors; empty for a normal RFQ.
  const preselectedVendorIds = useMemo(
    () => rfq?.vendors.map((v) => v.vendor_id) ?? [],
    [rfq?.vendors]
  );

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
          href={`/projects/${projectId}/order/rfq`}
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
            href: `/projects/${projectId}/order/rfq`,
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
    quotes.some((q) => isAwardableQuote(q.status));
  // §14: a PM can record a decline for an invited vendor that hasn't responded
  // yet (a declined/submitted vendor already has a quote row).
  const respondedVendorIds = new Set(quotes.map((q) => q.vendor_id));
  const canRecordResponse =
    canManage &&
    (QUOTE_SUBMITTABLE_RFQ_STATUSES as readonly string[]).includes(rfq.status);
  // Edit + Cancel are both gated on non-terminal status. Edits post-issue
  // are intentional (typo fixes / deadline extensions); a warning banner
  // inside the edit dialog tells the PM vendors will see the change.
  const isEditable = !isTerminal;
  const isCancellable = !isTerminal;
  // PM or architect can revise — matches the revise route (blockedRoles:
  // client/vendor) and RFQ-4a's "arch or PM initiate". Gating this on isPM
  // alone left an architect who removed an in-flight item staring at a
  // dead-end impact banner with no action.
  const canRevise =
    canManage &&
    (RFQ_REVISABLE_STATUSES as readonly string[]).includes(rfq.status);
  const hasMenuActions =
    (canManage && isEditable) || canRevise || (isPM && isCancellable);

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

  const handleRevise = async () => {
    setRevising(true);
    try {
      const next = await revise(rfqId, { reason: reviseReason.trim() || null });
      if (next) {
        setReviseOpen(false);
        setReviseReason("");
        router.push(`/projects/${projectId}/order/rfq/${next.id}`);
      }
    } finally {
      setRevising(false);
    }
  };

  const handleSyncBoq = async () => {
    setSyncingBoq(true);
    try {
      const res = await syncBoq(rfqId);
      if (res) await mutate();
    } finally {
      setSyncingBoq(false);
    }
  };

  // RFQ-3c: items whose live BOQ diverged from this RFQ's snapshot (only
  // populated for in-flight RFQs by getRfqDetail).
  const boqChangedItems = rfq.items.filter(
    (i) => (i.boq_changes?.length ?? 0) > 0
  );
  const hasQtyChange = boqChangedItems.some((i) =>
    i.boq_changes?.some((c) => c.field === "quantity")
  );
  // RFQ-3d: items removed from the BOQ (excluded) after the RFQ went out.
  const boqRemovedItems = rfq.items.filter((i) => i.boq_removed);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-10">
      <Link
        href={`/projects/${projectId}/order/rfq`}
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
            <RfqRevisionBadge revisionNumber={rfq.revision_number} />
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
          {canManage && canInviteMore && (
            <Button variant="secondary" onClick={() => setInviteOpen(true)}>
              <UserPlus2 className="w-4 h-4" />
              {t("inviteMoreBtn")}
            </Button>
          )}
          {canManage &&
            rfq.vendors.length > 0 &&
            QUOTE_SUBMITTABLE_RFQ_STATUSES.includes(
              rfq.status as (typeof QUOTE_SUBMITTABLE_RFQ_STATUSES)[number]
            ) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setManualQuoteVendorId(null);
                  setManualQuoteOpen(true);
                }}
              >
                <FileText className="w-4 h-4" />
                Enter quote
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
          {/* Management actions live in an overflow menu to keep the bar to the
              primary workflow CTAs. */}
          {hasMenuActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={t("moreActions")}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && isEditable && (
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4" />
                    {t("editBtn")}
                  </DropdownMenuItem>
                )}
                {canRevise && (
                  <DropdownMenuItem onClick={() => setReviseOpen(true)}>
                    <GitBranch className="w-4 h-4" />
                    {t("reviseBtn")}
                  </DropdownMenuItem>
                )}
                {isPM && isCancellable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onClick={() => setCancelOpen(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("cancelBtn")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Revision chain banners */}
      {rfq.supersedes && (
        <Link
          href={`/projects/${projectId}/order/rfq/${rfq.supersedes.id}`}
          className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated/50 px-4 py-2.5 text-sm text-text-secondary hover:border-text-muted/40 transition-colors w-fit"
        >
          <GitBranch className="w-4 h-4 text-text-muted shrink-0" />
          {t("revisionOf", {
            number: rfq.supersedes.rfq_number,
            rev: rfq.revision_number,
          })}
        </Link>
      )}
      {rfq.supersedes && rfq.revision_reason && (
        <p className="-mt-1 pl-1 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">
            {t("revisionReasonLabel")}:
          </span>{" "}
          {rfq.revision_reason}
        </p>
      )}
      {rfq.superseded_by && (
        <Link
          href={`/projects/${projectId}/order/rfq/${rfq.superseded_by.id}`}
          className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-text-primary hover:border-warning/60 transition-colors w-fit"
        >
          <GitBranch className="w-4 h-4 text-warning shrink-0" />
          {t("supersededBy", {
            number: rfq.superseded_by.rfq_number,
            rev: rfq.superseded_by.revision_number,
          })}
        </Link>
      )}

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
          label={t("packageType")}
          value={
            rfq.package_type ? tRfq(`packageType.${rfq.package_type}`) : "—"
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

      {/* RFQ-3c: BOQ divergence banner — the live BOQ changed after this RFQ
          went out. Qty changes can be synced (reuse rate); spec changes need a
          revision (re-quote). */}
      {boqChangedItems.length > 0 && (
        <RfqImpactBanner
          tone="warning"
          title={t("boqChangedTitle", { count: boqChangedItems.length })}
          footer={
            <>
              {hasQtyChange && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncBoq}
                  disabled={syncingBoq}
                >
                  {t("syncBoqBtn")}
                </Button>
              )}
              {canRevise && (
                <Button size="sm" onClick={() => setReviseOpen(true)}>
                  <GitBranch className="w-4 h-4" />
                  {t("reviseBtn")}
                </Button>
              )}
            </>
          }
        >
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-text-secondary">
            {boqChangedItems.map((it) => (
              <li key={it.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium text-text-primary">
                  {it.description}
                </span>
                {(it.boq_changes ?? []).map((c) => (
                  <span key={c.field} className="tabular-nums">
                    {t(`boqChangeField.${c.field}`)}{" "}
                    <span className="line-through text-text-muted">
                      {String(c.from)}
                    </span>{" "}
                    → {String(c.to)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </RfqImpactBanner>
      )}

      {/* RFQ-3d: items removed from the BOQ after this RFQ went out. Removal
          needs a re-quote, so the only path is a revision (which drops them). */}
      {boqRemovedItems.length > 0 && (
        <RfqImpactBanner
          tone="error"
          title={t("boqRemovedTitle", { count: boqRemovedItems.length })}
          footer={
            canRevise && (
              <Button size="sm" onClick={() => setReviseOpen(true)}>
                <GitBranch className="w-4 h-4" />
                {t("reviseBtn")}
              </Button>
            )
          }
        >
          <ul className="mt-1.5 flex flex-col gap-1 text-xs">
            {boqRemovedItems.map((it) => (
              <li key={it.id} className="line-through text-text-muted truncate">
                {it.description}
              </li>
            ))}
          </ul>
        </RfqImpactBanner>
      )}

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
        <RfqItemsTable
          items={rfq.items}
          labels={{
            description: t("col.description"),
            unit: t("col.unit"),
            quantity: t("col.quantity"),
            specNotes: t("col.specNotes"),
          }}
          renderActions={
            canManage && !isTerminal
              ? (it) => (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setAttachmentTarget(it)}
                      aria-label={t("attachmentsTitle")}
                      className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4" />
                      {(it.attachments?.length ?? 0) > 0 && (
                        <span className="text-xs tabular-nums">
                          {it.attachments!.length}
                        </span>
                      )}
                    </button>
                    {isDraft && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        disabled={removingItemId === it.id}
                        aria-label={t("removeItem")}
                        className="text-text-muted hover:text-error transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              : undefined
          }
        />
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
        <div className="px-6 py-4 border-b border-border-default flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">
              {t("vendorsHeading", { count: rfq.vendors.length })}
            </h2>
            {rfq.vendors.length === 0 && (
              <p className="text-xs text-text-muted mt-1">
                {t("vendorsEmpty")}
              </p>
            )}
          </div>
          {canManage && isDraft && (
            <Button size="sm" onClick={() => setIssueOpen(true)}>
              <Mail className="w-4 h-4" />
              {t("issueBtn")}
            </Button>
          )}
          {canManage && canInviteMore && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus2 className="w-4 h-4" />
              {t("inviteMoreBtn")}
            </Button>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {v.vendor_name}
                    </span>
                    {v.distribution_method && (
                      <DistributionMethodBadge method={v.distribution_method} />
                    )}
                  </div>
                  {v.vendor_code && (
                    <div className="text-xs text-text-muted">
                      {v.vendor_code}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-text-muted text-right">
                    {t("invitedAt")} · {formatDate(v.invited_at)}
                    {v.contact_name && (
                      <> · {t("sentTo", { name: v.contact_name })}</>
                    )}
                    {v.invited_by_name && (
                      <> · {t("invitedBy", { name: v.invited_by_name })}</>
                    )}
                  </span>
                  {canRecordResponse &&
                    !respondedVendorIds.has(v.vendor_id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeclineVendor({
                            id: v.vendor_id,
                            name: v.vendor_name,
                          })
                        }
                        className="cursor-pointer"
                      >
                        {t("recordDecline")}
                      </Button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity timeline — at the bottom of the page, GH/tasks-style. */}
      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("timelineHeading")}
          </h2>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLogCommOpen(true)}
            >
              <MessageSquare className="w-4 h-4" />
              {tRfq("logComm.title")}
            </Button>
          )}
        </div>
        <RfqStatusTimeline events={rfq.events} />
      </section>

      <RfqIssueDialog
        projectId={projectId}
        rfqId={rfqId}
        open={issueOpen}
        onOpenChange={setIssueOpen}
        onConfirm={handleIssue}
        preselectedVendorIds={preselectedVendorIds}
      />

      <RfqIssueDialog
        projectId={projectId}
        rfqId={rfqId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onConfirm={handleInvite}
        mode="invite"
        lockedVendorIds={preselectedVendorIds}
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

      <ConfirmDialog
        open={reviseOpen}
        onOpenChange={(o) => {
          setReviseOpen(o);
          if (!o) setReviseReason("");
        }}
        title={t("reviseConfirmTitle")}
        description={t("reviseConfirmDescription")}
        confirmLabel={t("reviseConfirm")}
        cancelLabel={t("keepRfq")}
        submitting={revising}
        onConfirm={handleRevise}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-text-secondary">
            {t("reviseReasonLabel")}
          </label>
          <textarea
            className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
            rows={3}
            value={reviseReason}
            onChange={(e) => setReviseReason(e.target.value)}
            maxLength={2000}
            placeholder={t("reviseReasonPlaceholder")}
          />
        </div>
      </ConfirmDialog>

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

      <ManualQuoteDialog
        projectId={projectId}
        rfq={rfq}
        vendors={rfq.vendors.map((v) => ({
          vendor_id: v.vendor_id,
          vendor_name: v.vendor_name,
        }))}
        quotes={quotes}
        open={manualQuoteOpen}
        onOpenChange={setManualQuoteOpen}
        preselectedVendorId={manualQuoteVendorId}
        onEntered={() => {
          mutateQuotes();
          mutateComparison();
          mutate();
        }}
      />

      <DeclineQuoteDialog
        open={declineVendor !== null}
        onOpenChange={(o) => !o && setDeclineVendor(null)}
        vendorName={declineVendor?.name}
        onConfirm={async (reason) => {
          if (!declineVendor) return;
          try {
            await quotesApi.decline(projectId, rfqId, declineVendor.id, reason);
            toast({ title: t("declineRecorded") });
            mutateQuotes();
            mutateComparison();
          } catch (err) {
            toast({
              title: err instanceof Error ? err.message : t("declineFailed"),
              variant: "error",
            });
          }
        }}
      />

      <RfqItemAttachmentsDialog
        projectId={projectId}
        rfqId={rfqId}
        item={attachmentTarget}
        open={attachmentTarget !== null}
        onOpenChange={(o) => {
          if (!o) setAttachmentTarget(null);
        }}
        onSaved={() => {
          mutate();
          setAttachmentTarget(null);
        }}
      />

      <RfqLogCommunicationDialog
        projectId={projectId}
        rfqId={rfqId}
        vendors={rfq.vendors}
        open={logCommOpen}
        onOpenChange={setLogCommOpen}
        onLogged={() => mutate()}
      />
    </div>
  );
}

/**
 * Warning/error callout used for the RFQ-3c (changed) and RFQ-3d (removed) BOQ
 * impact banners — shared chrome so the two stay visually aligned; callers
 * supply the item list (`children`) and the action buttons (`footer`).
 */
function RfqImpactBanner({
  tone,
  title,
  children,
  footer,
}: {
  tone: "warning" | "error";
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-3",
        tone === "error"
          ? "border-error/40 bg-error/10"
          : "border-warning/40 bg-warning/10"
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "w-4 h-4 mt-0.5 shrink-0",
            tone === "error" ? "text-error" : "text-warning"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {children}
        </div>
      </div>
      {footer && <div className="flex justify-end gap-2">{footer}</div>}
    </section>
  );
}
