"use client";

import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { QuoteStatusBadge } from "@/components/rfq/QuoteStatusBadge";
import { ResponseSourceBadge } from "@/components/rfq/ResponseSourceBadge";
import { API } from "@/lib/api/routes";
import { formatDate } from "@/lib/formatDate";
import { sumQuoteUnitPrices } from "@/lib/quoteTotal";
import type { VendorQuoteWithItems } from "@/types";

interface Props {
  projectId: string;
  rfqId: string;
  /** The current quote — supplies the vendor name + the id we key history off. */
  quote: VendorQuoteWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Read-only history of a vendor's quote — every version (current + superseded),
 * newest first, with how/when it arrived and its line-total. Lazy-loads on open.
 */
export function QuoteVersionHistoryDialog({
  projectId,
  rfqId,
  quote,
  open,
  onOpenChange,
}: Props) {
  const { data, isLoading } = useSWR<{ versions: VendorQuoteWithItems[] }>(
    open && quote ? API.rfqQuoteVersions(projectId, rfqId, quote.id) : null
  );
  const versions = data?.versions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Quote history</DialogTitle>
          {quote && <DialogDescription>{quote.vendor_name}</DialogDescription>}
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto flex flex-col gap-2">
          {isLoading && versions.length === 0
            ? Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            : versions.map((v) => {
                const total = sumQuoteUnitPrices(v.items);
                const isDeclined = v.status === "declined";
                return (
                  <div
                    key={v.id}
                    className={`rounded-lg border px-3 py-2.5 ${
                      v.is_current
                        ? "border-accent/40 bg-accent/5"
                        : "border-border-default"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">
                          v{v.version}
                        </span>
                        {v.is_current ? (
                          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
                            Superseded
                          </span>
                        )}
                        <QuoteStatusBadge status={v.status} />
                        <ResponseSourceBadge source={v.response_source} />
                      </div>
                      <span className="text-sm tabular-nums text-text-muted shrink-0">
                        {isDeclined ? (
                          "No bid"
                        ) : (
                          <>
                            {total.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {v.currency}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {isDeclined
                        ? "Declined"
                        : `${v.items.length} item${v.items.length === 1 ? "" : "s"}`}{" "}
                      · {formatDate(v.received_date ?? v.submitted_at)}
                    </div>
                  </div>
                );
              })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
