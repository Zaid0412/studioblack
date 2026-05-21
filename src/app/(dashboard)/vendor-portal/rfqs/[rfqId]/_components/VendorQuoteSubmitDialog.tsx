"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { formatDate } from "@/lib/formatDate";
import type { RfqItem, RfqWithItems, VendorQuoteWithItems } from "@/types";

interface Props {
  rfq: Pick<
    RfqWithItems,
    "id" | "rfq_number" | "title" | "response_deadline"
  > & { items: RfqItem[] };
  existing: VendorQuoteWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
}

export interface SubmitPayload {
  validUntil?: string | null;
  currency?: string;
  deliveryPeriod?: string | null;
  paymentTerms?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  notes?: string | null;
  items: Array<{
    rfqItemId: string;
    unitPrice: number;
    notes?: string | null;
    alternativeSpec?: string | null;
  }>;
}

/**
 * Vendor quote submission / revision form. Pre-fills from `existing` when
 * the vendor has already submitted. Submission is blocked client-side
 * until every RFQ item has a non-negative unit price — the server enforces
 * the same check, but failing fast keeps the dialog responsive.
 */
export function VendorQuoteSubmitDialog({
  rfq,
  existing,
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const initialPrices = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of rfq.items) {
      const existingLine = existing?.items.find(
        (li) => li.rfq_item_id === it.id
      );
      map.set(it.id, existingLine ? String(existingLine.unit_price) : "");
    }
    return map;
  }, [rfq.items, existing]);

  const [prices, setPrices] = useState<Map<string, string>>(initialPrices);
  const [validUntil, setValidUntil] = useState<Date | undefined>(
    existing?.valid_until
      ? new Date(`${existing.valid_until}T00:00:00`)
      : undefined
  );
  const [deliveryPeriod, setDeliveryPeriod] = useState(
    existing?.delivery_period ?? ""
  );
  const [paymentTerms, setPaymentTerms] = useState(
    existing?.payment_terms ?? ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever the dialog opens with a different state.
  useEffect(() => {
    if (open) {
      setPrices(initialPrices);
      setValidUntil(
        existing?.valid_until
          ? new Date(`${existing.valid_until}T00:00:00`)
          : undefined
      );
      setDeliveryPeriod(existing?.delivery_period ?? "");
      setPaymentTerms(existing?.payment_terms ?? "");
      setNotes(existing?.notes ?? "");
    }
  }, [open, existing, initialPrices]);

  const isLate = useMemo(() => {
    if (!rfq.response_deadline) return false;
    return new Date() > new Date(`${rfq.response_deadline}T23:59:59`);
  }, [rfq.response_deadline]);

  const grandTotal = useMemo(() => {
    let sum = 0;
    for (const it of rfq.items) {
      const raw = prices.get(it.id);
      const price = raw ? Number(raw) : NaN;
      if (Number.isFinite(price) && price >= 0) {
        sum += price * Number(it.quantity);
      }
    }
    return sum;
  }, [rfq.items, prices]);

  const allFilled = useMemo(() => {
    for (const it of rfq.items) {
      const raw = prices.get(it.id);
      const price = raw ? Number(raw) : NaN;
      if (!Number.isFinite(price) || price < 0) return false;
    }
    return rfq.items.length > 0;
  }, [rfq.items, prices]);

  async function handleSubmit() {
    if (!allFilled || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
        deliveryPeriod: deliveryPeriod || null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        items: rfq.items.map((it) => ({
          rfqItemId: it.id,
          unitPrice: Number(prices.get(it.id) ?? 0),
        })),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Revise quote" : "Submit quote"}
          </DialogTitle>
          <DialogDescription>
            {rfq.rfq_number} — {rfq.title}
          </DialogDescription>
        </DialogHeader>

        {isLate && (
          <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-text-primary">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-status-warning" />
            <div>
              <p className="font-medium">Late submission</p>
              <p className="text-text-secondary">
                The deadline ({formatDate(rfq.response_deadline!)}) has passed.
                Your quote will be flagged as late.
              </p>
            </div>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          <div className="overflow-x-auto rounded-md border border-border-default">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated text-text-muted">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right w-36">
                    Unit price
                  </th>
                  <th className="px-3 py-2 font-medium text-right w-28">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rfq.items.map((it) => {
                  const raw = prices.get(it.id) ?? "";
                  const price = raw ? Number(raw) : NaN;
                  const lineTotal =
                    Number.isFinite(price) && price >= 0
                      ? price * Number(it.quantity)
                      : 0;
                  return (
                    <tr key={it.id} className="border-t border-border-default">
                      <td className="px-3 py-2 text-text-primary">
                        <div>{it.description}</div>
                        {it.spec_notes && (
                          <div className="text-xs text-text-muted mt-0.5">
                            {it.spec_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {it.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                        {it.quantity}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={raw}
                          onChange={(e) => {
                            const next = new Map(prices);
                            next.set(it.id, e.target.value);
                            setPrices(next);
                          }}
                          className="text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-primary">
                        {lineTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-default bg-bg-elevated">
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-sm font-medium text-text-primary"
                  >
                    Grand total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-text-primary">
                    {grandTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker
              label="Valid until"
              value={validUntil}
              onChange={setValidUntil}
              placeholder="Optional"
            />
            <Input
              label="Delivery period"
              placeholder="e.g. 4–6 weeks"
              value={deliveryPeriod}
              onChange={(e) => setDeliveryPeriod(e.target.value)}
              maxLength={100}
            />
            <Input
              label="Payment terms"
              placeholder="e.g. 50% advance, 50% on delivery"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              maxLength={100}
            />
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-text-muted mb-1.5 block">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any clarifications, exclusions, or alternative specs."
                className="w-full rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="cursor-pointer">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!allFilled || submitting}
            className="cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existing ? "Update quote" : "Submit quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
