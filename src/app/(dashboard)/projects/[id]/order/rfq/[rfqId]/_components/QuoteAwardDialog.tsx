"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { isAwardableQuote, isInactiveQuote } from "@/lib/validations";
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
  const t = useTranslations("rfq");
  const tCommon = useTranslations("common");
  const awardableQuotes = useMemo(
    () => quotes.filter((q) => isAwardableQuote(q.status)),
    [quotes]
  );

  // §14: a single-vendor award must cover every item, so partial quotes can't
  // win the whole RFQ (the server returns `incomplete_quote`). Gate them out of
  // the single tab up front using per-vendor coverage from the comparison.
  const itemCount = comparison?.items.length ?? 0;
  const coverageByVendor = useMemo(() => {
    const m = new Map<string, number>();
    if (!comparison) return m;
    for (const v of comparison.vendors) {
      m.set(
        v.vendor_id,
        comparison.items.filter((it) => it.vendor_prices[v.vendor_id]).length
      );
    }
    return m;
  }, [comparison]);
  // When coverage can't be determined (no comparison), allow — the server guards.
  const isFullCoverage = useCallback(
    (q: VendorQuoteWithItems) =>
      !comparison ||
      itemCount === 0 ||
      (coverageByVendor.get(q.vendor_id) ?? 0) >= itemCount,
    [comparison, itemCount, coverageByVendor]
  );
  const pickDefaultSingle = useCallback(() => {
    const pre = awardableQuotes.find((q) => q.id === preselectedQuoteId);
    if (pre && isFullCoverage(pre)) return pre.id;
    return awardableQuotes.find(isFullCoverage)?.id ?? "";
  }, [awardableQuotes, preselectedQuoteId, isFullCoverage]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [singleChoice, setSingleChoice] = useState<string>(pickDefaultSingle);
  const [splitAssignments, setSplitAssignments] = useState<Map<string, string>>(
    new Map()
  );
  const [submitting, setSubmitting] = useState(false);

  // Re-initialise selections when the dialog opens or quotes change.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSingleChoice(pickDefaultSingle());
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
  }, [open, comparison, initialMode, pickDefaultSingle]);

  const allAssigned = useMemo(
    () =>
      comparison != null &&
      comparison.items.every((it) => splitAssignments.has(it.rfq_item_id)),
    [comparison, splitAssignments]
  );

  // Running total for the split tab: sum the line total (unit price × qty)
  // of whichever vendor is currently chosen per item. Currency is shown only
  // when every assigned line shares one — split awards can mix vendors with
  // different currencies, which the server-side award still allows per item.
  const splitTotal = useMemo(() => {
    if (!comparison) return null;
    let sum = 0;
    let assignedCount = 0;
    const currencies = new Set<string>();
    for (const row of comparison.items) {
      const quoteItemId = splitAssignments.get(row.rfq_item_id);
      if (!quoteItemId) continue;
      for (const [vendorId, line] of Object.entries(row.vendor_prices)) {
        if (line.quote_item_id === quoteItemId) {
          sum += line.line_total;
          assignedCount += 1;
          const vendorCol = comparison.vendors.find(
            (v) => v.vendor_id === vendorId
          );
          if (vendorCol) currencies.add(vendorCol.currency);
          break;
        }
      }
    }
    if (assignedCount === 0) return null;
    return { sum, currency: currencies.size === 1 ? [...currencies][0] : null };
  }, [comparison, splitAssignments]);

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
          <DialogTitle>{t("quotes.awardDialogTitle")}</DialogTitle>
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
            {t("quotes.singleVendorTab")}
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
            {t("quotes.splitPerItemTab")}
          </button>
        </div>

        {mode === "single" ? (
          <div className="max-h-[50vh] overflow-y-auto">
            {awardableQuotes.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                {t("quotes.noAwardableQuotes")}
              </p>
            ) : (
              <ul className="divide-y divide-border-default">
                {awardableQuotes.map((q) => {
                  const total = q.items.reduce(
                    (sum, i) => sum + Number(i.unit_price),
                    0
                  );
                  const full = isFullCoverage(q);
                  const covered = coverageByVendor.get(q.vendor_id) ?? 0;
                  return (
                    <li key={q.id}>
                      <label
                        className={`flex items-center gap-3 px-3 py-3 ${
                          full
                            ? "cursor-pointer hover:bg-bg-elevated"
                            : "opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <input
                          type="radio"
                          name="award-single"
                          value={q.id}
                          checked={singleChoice === q.id}
                          disabled={!full}
                          onChange={() => setSingleChoice(q.id)}
                          className={
                            full ? "cursor-pointer" : "cursor-not-allowed"
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary">
                            {q.vendor_name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {q.is_late ? `${t("quotes.late")} · ` : ""}
                            {t("quotes.submittedLabel")}{" "}
                            {new Date(q.submitted_at).toLocaleDateString()}
                            {!full && comparison && (
                              <span className="text-warning">
                                {" · "}
                                {t("quotes.partialCoverage", {
                                  covered,
                                  total: itemCount,
                                })}
                              </span>
                            )}
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
                {t("quotes.noComparisonData")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-bg-elevated text-text-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">
                      {t("comparison.colItem")}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t("quotes.colVendor")}
                    </th>
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
                        <Select
                          value={
                            splitAssignments.get(row.rfq_item_id) || undefined
                          }
                          onValueChange={(val) => {
                            const next = new Map(splitAssignments);
                            if (val) next.set(row.rfq_item_id, val);
                            else next.delete(row.rfq_item_id);
                            setSplitAssignments(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("quotes.chooseVendorPlaceholder")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(row.vendor_prices).map(
                              ([vendorId, line]) => {
                                const v = comparison.vendors.find(
                                  (col) => col.vendor_id === vendorId
                                );
                                if (!v || isInactiveQuote(v.quote_status)) {
                                  return null;
                                }
                                return (
                                  <SelectItem
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
                                  </SelectItem>
                                );
                              }
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {splitTotal && (
              <div className="flex items-center justify-end gap-2 px-3 py-2.5 mt-1 border-t border-border-default text-sm">
                <span className="text-text-muted">
                  {t("quotes.splitTotal")}
                </span>
                <span className="font-semibold text-text-primary tabular-nums">
                  {splitTotal.sum.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {splitTotal.currency ? ` ${splitTotal.currency}` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="cursor-pointer">
              {tCommon("cancel")}
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
            {t("quotes.confirmAward")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
