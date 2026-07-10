"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { FileText } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useRfqDetail } from "@/hooks/useRfqs";
import {
  useAwardRfq,
  useQuoteComparison,
  useQuotesForRfq,
} from "@/hooks/useQuotes";
import {
  isAwardableQuote,
  QUOTE_AWARDABLE_RFQ_STATUSES,
} from "@/lib/validations";
import { RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";
import { RespondedChip } from "@/components/rfq/RespondedChip";
import { QuoteAwardDialog } from "../_components/QuoteAwardDialog";
import { QuoteComparisonTable } from "./_components/QuoteComparisonTable";

/**
 * Side-by-side quote comparison view. Architects and PMs use this to
 * pick a winner; the Award CTA opens the same QuoteAwardDialog used on
 * the RFQ detail page so both surfaces stay in sync.
 */
export default function RfqComparisonPage({
  params,
}: {
  params: Promise<{ id: string; rfqId: string }>;
}) {
  const { id: projectId, rfqId } = use(params);
  const t = useTranslations("rfq");
  const { role } = useUserRole();
  const isPM = role === "pm";

  const {
    rfq,
    notFound,
    isLoading: rfqLoading,
    mutate,
  } = useRfqDetail(projectId, rfqId);
  const { quotes } = useQuotesForRfq(projectId, rfqId);
  const { comparison, isLoading: cmpLoading } = useQuoteComparison(
    projectId,
    rfqId
  );
  const { awardSingle, awardSplit } = useAwardRfq(projectId, rfqId);

  const [awardOpen, setAwardOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<"single" | "split">("single");

  const isLoading = rfqLoading || cmpLoading;
  const canAward =
    rfq != null &&
    (QUOTE_AWARDABLE_RFQ_STATUSES as readonly string[]).includes(rfq.status) &&
    quotes.some((q) => isAwardableQuote(q.status));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
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
          {t("detail.back")}
        </Link>
        <EmptyState
          icon={FileText}
          title={t("detail.notFound")}
          description={t("detail.notFoundHint")}
          action={{
            label: t("detail.back"),
            href: `/projects/${projectId}/order/rfq`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-10">
      <Link
        href={`/projects/${projectId}/order/rfq/${rfqId}`}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("comparison.backToRfq", { number: rfq.rfq_number })}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl lg:text-2xl font-bold text-text-primary">
              {t("comparison.title")}
            </h1>
            <RfqStatusBadge status={rfq.status} />
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {rfq.rfq_number} — {rfq.title}
          </p>
          {comparison &&
            comparison.vendors.length + comparison.invited_no_response.length >
              0 && (
              <div className="mt-2">
                <RespondedChip
                  variant="pill"
                  responded={comparison.vendors.length}
                  total={
                    comparison.vendors.length +
                    comparison.invited_no_response.length
                  }
                />
              </div>
            )}
        </div>
        {isPM && canAward && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => {
                setInitialMode("split");
                setAwardOpen(true);
              }}
              className="cursor-pointer"
            >
              {t("comparison.splitAward")}
            </Button>
            <Button
              onClick={() => {
                setInitialMode("single");
                setAwardOpen(true);
              }}
              className="cursor-pointer"
            >
              <Award className="w-4 h-4" />
              {t("quotes.award")}
            </Button>
          </div>
        )}
      </div>

      {comparison && comparison.invited_no_response.length > 0 && (
        <div className="rounded-xl border border-border-default bg-bg-secondary px-4 py-3 text-xs text-text-muted">
          {t("comparison.waitingOn", {
            names: comparison.invited_no_response
              .map((v) => v.vendor_name)
              .join(", "),
          })}
        </div>
      )}

      {comparison && <QuoteComparisonTable comparison={comparison} />}

      <QuoteAwardDialog
        rfqTitle={rfq.title}
        rfqNumber={rfq.rfq_number}
        quotes={quotes}
        comparison={comparison}
        open={awardOpen}
        onOpenChange={setAwardOpen}
        initialMode={initialMode}
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
