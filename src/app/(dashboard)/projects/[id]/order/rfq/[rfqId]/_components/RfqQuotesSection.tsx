"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, Clock, History, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { QuoteStatusBadge } from "@/components/rfq/QuoteStatusBadge";
import { ResponseSourceBadge } from "@/components/rfq/ResponseSourceBadge";
import { RESPONSE_SOURCE_LABELS } from "@/lib/rfqLabels";
import { formatDate } from "@/lib/formatDate";
import { versionColor } from "@/lib/fileUtils";
import { sumQuoteUnitPrices } from "@/lib/quoteTotal";
import type { VendorQuoteWithItems } from "@/types";
import { QuoteVersionHistoryDialog } from "./QuoteVersionHistoryDialog";

interface Props {
  projectId: string;
  rfqId: string;
  quotes: VendorQuoteWithItems[];
  invitedCount: number;
  canAward: boolean;
  isPM: boolean;
  lastViewedAt: string | null;
  onAwardClick: (quoteId: string) => void;
}

/**
 * Studio-side quote list embedded in the RFQ detail page. Shows each
 * vendor's submission with status, late badge, and a one-click "Award"
 * affordance per quote (PM only). A "View comparison" link sends the
 * user to the side-by-side comparison page.
 */
export function RfqQuotesSection({
  projectId,
  rfqId,
  quotes,
  invitedCount,
  canAward,
  isPM,
  lastViewedAt,
  onAwardClick,
}: Props) {
  const responseRate = `${quotes.length} of ${invitedCount}`;
  const [historyQuote, setHistoryQuote] = useState<VendorQuoteWithItems | null>(
    null
  );
  // When any quote has been revised, reserve the history slot on every row so
  // the Award button stays aligned regardless of which rows have history.
  const hasHistory = quotes.some((q) => q.version > 1);

  return (
    <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Quotes received
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {responseRate} vendors responded
          </p>
        </div>
        {quotes.length > 0 && (
          <Link
            href={`/projects/${projectId}/order/rfq/${rfqId}/comparison`}
            className="group inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border-default bg-bg-elevated text-[13px] font-medium text-text-primary hover:bg-bg-input hover:border-text-muted/40 transition-colors"
          >
            <span>View comparison</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {quotes.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            Waiting for vendors to respond.
          </p>
          <p className="text-xs text-text-muted mt-1">
            Invited vendors will see this RFQ in their portal and submit quotes
            from there.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-default">
          {quotes.map((q) => {
            const total = sumQuoteUnitPrices(q.items);
            const isNew =
              lastViewedAt === null || q.submitted_at > lastViewedAt;
            const vc = versionColor(q.version);
            return (
              <li
                key={q.id}
                className="px-6 py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {q.vendor_name}
                    </span>
                    {q.version > 1 && (
                      <span
                        className={`inline-flex items-center rounded-full h-[18px] px-1.5 text-[10px] font-bold leading-none ${vc.bg} ${vc.text} ${vc.border}`}
                      >
                        V{q.version}
                      </span>
                    )}
                    <QuoteStatusBadge status={q.status} />
                    <ResponseSourceBadge source={q.response_source} />
                    {isNew && (
                      <span className="text-xs font-medium text-status-submitted bg-status-submitted/10 px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                    {q.is_late && (
                      <span className="text-xs font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                        Late
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Submitted {formatDate(q.submitted_at)}
                    {q.valid_until && (
                      <> · Valid until {formatDate(q.valid_until)}</>
                    )}
                  </div>
                  {q.attachments && q.attachments.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {q.attachments.map((a, i) => {
                        const meta = [
                          a.fileType?.toUpperCase(),
                          a.source && RESPONSE_SOURCE_LABELS[a.source],
                          a.uploadedAt && formatDate(a.uploadedAt),
                          a.uploadedByName && `by ${a.uploadedByName}`,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <li
                            key={`${a.url}-${i}`}
                            className="flex items-start gap-1.5 text-xs min-w-0"
                          >
                            <Paperclip className="w-3 h-3 text-text-muted shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-text-secondary hover:text-text-primary break-all"
                              >
                                {a.fileName}
                              </a>
                              {meta && (
                                <span className="text-text-muted">
                                  {" "}
                                  · {meta}
                                </span>
                              )}
                              {a.notes && (
                                <div className="text-text-muted italic break-words">
                                  {a.notes}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="text-right tabular-nums text-sm shrink-0">
                  <div className="text-text-primary font-medium">
                    {total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-text-muted">{q.currency}</div>
                </div>
                {hasHistory && (
                  <div className="w-8 shrink-0">
                    {q.version > 1 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setHistoryQuote(q)}
                            aria-label="Version history"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Version history</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
                {isPM && canAward && q.status !== "expired" && (
                  <Button
                    size="sm"
                    onClick={() => onAwardClick(q.id)}
                    className="cursor-pointer shrink-0"
                  >
                    <Award className="w-4 h-4" />
                    Award
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <QuoteVersionHistoryDialog
        projectId={projectId}
        rfqId={rfqId}
        quote={historyQuote}
        open={historyQuote !== null}
        onOpenChange={(o) => !o && setHistoryQuote(null)}
      />
    </section>
  );
}
