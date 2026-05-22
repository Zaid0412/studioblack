"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { QuoteComparison, VendorQuoteWithItems } from "@/types";

type Mode = "single" | "split";

interface Props {
  rfqTitle: string;
  rfqNumber: string;
  quotes: VendorQuoteWithItems[];
  comparison: QuoteComparison | null;
  preselectedQuoteId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAwardSingle: (quoteId: string) => Promise<void>;
  onAwardSplit: (
    awards: Array<{ rfqItemId: string; quoteItemId: string }>
  ) => Promise<void>;
  initialMode?: Mode;
}

/**
 * Two-tab award dialog. "Single" picks one quote to win the entire RFQ;
 * "Split" assigns each RFQ item to the winning vendor's line — every
 * item must be assigned before submit. Both flows post to the server,
 * which validates coverage and quote expiry inside a transaction.
 */
export function QuoteAwardDialog({
  rfqTitle,
  rfqNumber,
  quotes,
  comparison,
  preselectedQuoteId,
  open,
  onOpenChange,
  onAwardSingle,
  onAwardSplit,
  initialMode = "single",
}: Props) {
  const awardableQuotes = useMemo(
    () => quotes.filter((q) => q.status !== "expired"),
    [quotes]
  );
  const [mode, setMode] = useState<Mode>(initialMode);
  const [singleChoice, setSingleChoice] = useState<string>(
    preselectedQuoteId ?? awardableQuotes[0]?.id ?? ""
  );
  const [splitAssignments, setSplitAssignments] = useState<Map<string, string>>(
    new Map()
  );
  const [submitting, setSubmitting] = useState(false);

  // Re-initialise selections when the dialog opens or quotes change.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSingleChoice(preselectedQuoteId ?? awardableQuotes[0]?.id ?? "");
      // Default split: pick the lowest-price vendor per row.
      const initial = new Map<string, string>();
      if (comparison) {
        for (const row of comparison.items) {
          let best: { vendorId: string; quoteItemId: string } | null = null;
          for (const [vendorId, line] of Object.entries(row.vendor_prices)) {
            if (line.is_lowest) {
              best = { vendorId, quoteItemId: line.quote_item_id };
              break;
            }
          }
          if (best) initial.set(row.rfq_item_id, best.quoteItemId);
        }
      }
      setSplitAssignments(initial);
    }
  }, [open, awardableQuotes, comparison, preselectedQuoteId, initialMode]);

  const allAssigned = useMemo(
    () =>
      comparison != null &&
      comparison.items.every((it) => splitAssignments.has(it.rfq_item_id)),
    [comparison, splitAssignments]
  );

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "single") {
        if (!singleChoice) return;
        await onAwardSingle(singleChoice);
      } else {
        if (!comparison || !allAssigned) return;
        const awards = Array.from(splitAssignments.entries()).map(
          ([rfqItemId, quoteItemId]) => ({ rfqItemId, quoteItemId })
        );
        await onAwardSplit(awards);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Award RFQ</DialogTitle>
          <DialogDescription>
            {rfqNumber} — {rfqTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border-default">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`cursor-pointer px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === "single"
                ? "border-brand-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            Single vendor
          </button>
          <button
            type="button"
            onClick={() => setMode("split")}
            className={`cursor-pointer px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === "split"
                ? "border-brand-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            Split per item
          </button>
        </div>

        {mode === "single" ? (
          <div className="max-h-[50vh] overflow-y-auto">
            {awardableQuotes.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                No quotes are available to award.
              </p>
            ) : (
              <ul className="divide-y divide-border-default">
                {awardableQuotes.map((q) => {
                  const total = q.items.reduce(
                    (sum, i) => sum + Number(i.unit_price),
                    0
                  );
                  return (
                    <li key={q.id}>
                      <label className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-bg-elevated">
                        <input
                          type="radio"
                          name="award-single"
                          value={q.id}
                          checked={singleChoice === q.id}
                          onChange={() => setSingleChoice(q.id)}
                          className="cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary">
                            {q.vendor_name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {q.is_late ? "Late · " : ""}Submitted{" "}
                            {new Date(q.submitted_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right tabular-nums text-sm">
                          {total.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {q.currency}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            {!comparison || comparison.items.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                No comparison data available yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-bg-elevated text-text-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.items.map((row) => (
                    <tr
                      key={row.rfq_item_id}
                      className="border-t border-border-default"
                    >
                      <td className="px-3 py-2 text-text-primary">
                        {row.description}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={splitAssignments.get(row.rfq_item_id) ?? ""}
                          onChange={(e) => {
                            const next = new Map(splitAssignments);
                            if (e.target.value) {
                              next.set(row.rfq_item_id, e.target.value);
                            } else {
                              next.delete(row.rfq_item_id);
                            }
                            setSplitAssignments(next);
                          }}
                          className="w-full rounded-md border border-border-default bg-bg-input px-2 py-1.5 text-sm cursor-pointer"
                        >
                          <option value="">Choose vendor…</option>
                          {Object.entries(row.vendor_prices).map(
                            ([vendorId, line]) => {
                              const v = comparison.vendors.find(
                                (col) => col.vendor_id === vendorId
                              );
                              if (!v || v.quote_status === "expired") {
                                return null;
                              }
                              return (
                                <option
                                  key={vendorId}
                                  value={line.quote_item_id}
                                >
                                  {v.vendor_name} —{" "}
                                  {line.unit_price.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  / {row.unit}
                                  {line.is_lowest ? " ★" : ""}
                                </option>
                              );
                            }
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="cursor-pointer">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || (mode === "single" ? !singleChoice : !allAssigned)
            }
            className="cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm award
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
