"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2, FileText, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/formatDate";
import { useVendorRfqDetail } from "@/hooks/useRfqs";
import {
  useVendorQuote,
  useVendorSubmitQuote,
  useVendorDeclineQuote,
} from "@/hooks/useQuotes";
import { DeclineQuoteDialog } from "@/components/rfq/DeclineQuoteDialog";
import { RfqDetailRow } from "@/components/rfq/RfqDetailRow";
import { RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";
import { QuoteStatusBadge } from "@/components/rfq/QuoteStatusBadge";
import { RfqItemsTable } from "@/components/rfq/RfqItemsTable";
import { RfqStatusTimeline } from "@/components/rfq/RfqStatusTimeline";
import { VendorQuoteSubmitDialog } from "./_components/VendorQuoteSubmitDialog";

/**
 * Vendor-portal RFQ detail. Read-only in F9 — the "Submit Quote" CTA is
 * disabled with a tooltip pointing at F10. We deliberately don't show who
 * else was invited (competitive info; the API strips it for vendor callers).
 */
export default function VendorPortalRfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = use(params);
  const t = useTranslations("vendorPortal.rfqDetail");

  const {
    rfq,
    notFound,
    isLoading,
    mutate: mutateRfq,
  } = useVendorRfqDetail(rfqId);
  const { quote, mutate: mutateQuote } = useVendorQuote(rfqId);
  const submitQuote = useVendorSubmitQuote(rfqId);
  const declineQuote = useVendorDeclineQuote(rfqId);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  // Two-phase dismiss: `closing` plays the collapse animation, then
  // `dismissed` unmounts the banner so it doesn't leave a flex gap.
  // localStorage persists across refreshes.
  const [closing, setClosing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`quote-award-banner-dismissed-${rfqId}`);
    } catch {
      // localStorage disabled (Safari private mode, etc.) — degrade silently.
    }
    if (stored === "1") {
      setDismissed(true); // eslint-disable-line react-hooks/set-state-in-effect -- sync from localStorage on mount
    }
  }, [rfqId]);

  function dismissBanner() {
    if (closing) return;
    try {
      localStorage.setItem(`quote-award-banner-dismissed-${rfqId}`, "1");
    } catch {
      // Quota exceeded or disabled — best-effort only.
    }
    setClosing(true);
    setTimeout(() => setDismissed(true), 300);
  }

  const canSubmit =
    rfq != null &&
    ["issued", "quotes_received", "under_review"].includes(rfq.status) &&
    (quote == null ||
      quote.status === "submitted" ||
      quote.status === "declined");
  // Offer "Decline" only when they could quote and haven't already declined.
  const canDecline = canSubmit && quote?.status !== "declined";
  const isAwardedToMe = quote?.status === "awarded";
  const isAwardedToOther =
    rfq?.status === "awarded" && quote?.status !== "awarded";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-[1100px]">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-start justify-between gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (notFound || !rfq) {
    return (
      <div className="flex flex-col gap-6 max-w-[1100px]">
        <Link
          href="/vendor-portal/rfqs"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </Link>
        <EmptyState
          icon={FileText}
          title={t("notFound")}
          description={t("notFoundHint")}
          action={{ label: t("back"), href: "/vendor-portal/rfqs" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1100px]">
      <Link
        href="/vendor-portal/rfqs"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back")}
      </Link>

      <PageHeader
        title={rfq.title}
        subtitle={`${rfq.rfq_number} · ${
          rfq.issued_date ? formatDate(rfq.issued_date) : ""
        }`}
        actions={
          <>
            <RfqStatusBadge status={rfq.status} />
            {/* Skip the duplicate "Awarded" badge once the RFQ badge
                already says Awarded — the two would otherwise stack. */}
            {quote && quote.status !== "awarded" && (
              <QuoteStatusBadge status={quote.status} />
            )}
            {canDecline && (
              <Button
                variant="secondary"
                onClick={() => setDeclineOpen(true)}
                className="cursor-pointer"
              >
                Decline
              </Button>
            )}
            {canSubmit && (
              <Button
                onClick={() => setSubmitOpen(true)}
                className="cursor-pointer"
              >
                {quote && quote.status !== "declined"
                  ? "Revise quote"
                  : "Submit quote"}
              </Button>
            )}
            <RefreshButton
              onRefresh={async () => {
                await Promise.all([mutateRfq(), mutateQuote()]);
              }}
            />
          </>
        }
      />

      {isAwardedToMe && !dismissed && (
        <div
          className={`grid motion-safe:transition-[grid-template-rows,opacity,margin] motion-safe:duration-300 ease-out ${
            closing
              ? "grid-rows-[0fr] opacity-0 -my-3"
              : "grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="overflow-hidden">
            <div className="relative flex items-start gap-3 rounded-xl border border-status-approved-arch/40 bg-status-approved-arch/10 px-4 py-3 text-sm">
              <CheckCircle2 className="w-5 h-5 mt-0.5 text-status-approved-arch shrink-0" />
              <div className="pr-6">
                <div className="font-medium text-text-primary">
                  Your quote was awarded
                </div>
                <div className="text-text-secondary text-xs">
                  The studio will follow up with a purchase order shortly.
                </div>
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Dismiss"
                className="absolute top-2 right-2 p-1 rounded text-text-muted hover:text-text-primary hover:bg-black/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isAwardedToOther && (
        <div className="flex items-start gap-3 rounded-xl border border-border-default bg-bg-secondary px-4 py-3 text-sm">
          <XCircle className="w-5 h-5 mt-0.5 text-text-muted shrink-0" />
          <div>
            <div className="font-medium text-text-primary">
              This RFQ has been awarded
            </div>
            <div className="text-text-secondary text-xs">
              Thank you for quoting — a different vendor was selected this time.
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-border-default bg-bg-secondary p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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

      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("itemsHeading", { count: rfq.items.length })}
          </h2>
        </div>
        <RfqItemsTable
          items={rfq.items}
          labels={{
            description: t("col.description"),
            unit: t("col.unit"),
            quantity: t("col.quantity"),
            specNotes: t("col.specNotes"),
          }}
        />
      </section>

      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("timelineHeading")}
          </h2>
        </div>
        <RfqStatusTimeline events={rfq.events} />
      </section>

      <VendorQuoteSubmitDialog
        rfq={rfq}
        existing={quote}
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSubmit={async (payload) => {
          await submitQuote(payload);
        }}
      />

      <DeclineQuoteDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        onConfirm={async (reason) => {
          await declineQuote(reason);
        }}
      />
    </div>
  );
}
