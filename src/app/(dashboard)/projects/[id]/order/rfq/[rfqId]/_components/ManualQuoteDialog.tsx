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
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { AttachmentsEditor } from "@/components/ui/AttachmentsEditor";
import { toast } from "@/components/ui/useToast";
import { quotes as quotesApi } from "@/lib/api";
import { toIsoDate, fromIsoDate } from "@/lib/formatDate";
import {
  RFQ_MANUAL_RESPONSE_SOURCES,
  QUOTE_CURRENCIES,
} from "@/lib/validations";
import { RESPONSE_SOURCE_ICONS, RESPONSE_SOURCE_LABELS } from "@/lib/rfqLabels";
import type {
  RfqItem,
  RfqWithItems,
  VendorQuoteWithItems,
  QuoteAttachment,
} from "@/types";

interface Props {
  projectId: string;
  rfq: Pick<RfqWithItems, "id" | "rfq_number" | "title"> & { items: RfqItem[] };
  /** Invited vendors (id + display name) — the quote target list. */
  vendors: { vendor_id: string; vendor_name: string }[];
  /** Existing quotes, to pre-fill when the chosen vendor already has one. */
  quotes: VendorQuoteWithItems[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVendorId?: string | null;
  onEntered: () => void;
}

/**
 * PM-side form to record a quote received off-portal on behalf of an invited
 * vendor: tags the response source + received date, captures per-item prices,
 * and attaches evidence (the emailed PDF/screenshot). Posts to the studio
 * `POST /quotes` route, which reuses the same submit path as the vendor portal.
 */
export function ManualQuoteDialog({
  projectId,
  rfq,
  vendors,
  quotes,
  open,
  onOpenChange,
  preselectedVendorId,
  onEntered,
}: Props) {
  const [vendorId, setVendorId] = useState(preselectedVendorId ?? "");
  const [source, setSource] = useState<string>("email");
  const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined);
  const [currency, setCurrency] = useState<string>("USD");
  const [prices, setPrices] = useState<Map<string, string>>(new Map());
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined);
  const [deliveryPeriod, setDeliveryPeriod] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const existing = useMemo(
    () => quotes.find((q) => q.vendor_id === vendorId) ?? null,
    [quotes, vendorId]
  );

  // (Re)initialise when the dialog opens or the chosen vendor changes — pre-fill
  // from that vendor's existing quote if there is one.
  useEffect(() => {
    if (!open) return;
    const map = new Map<string, string>();
    for (const it of rfq.items) {
      const line = existing?.items.find((li) => li.rfq_item_id === it.id);
      map.set(it.id, line ? String(line.unit_price) : "");
    }
    setPrices(map);
    setCurrency(existing?.currency ?? "USD");
    setDeliveryPeriod(existing?.delivery_period ?? "");
    setPaymentTerms(existing?.payment_terms ?? "");
    setNotes(existing?.notes ?? "");
    setValidUntil(fromIsoDate(existing?.valid_until));
    setReceivedDate(fromIsoDate(existing?.received_date) ?? new Date());
    setSource(
      existing && existing.response_source !== "portal"
        ? existing.response_source
        : "email"
    );
    setAttachments((existing?.attachments as QuoteAttachment[] | null) ?? []);
  }, [open, vendorId, existing, rfq.items]);

  const grandTotal = useMemo(() => {
    let sum = 0;
    for (const it of rfq.items) {
      const price = Number(prices.get(it.id));
      if (Number.isFinite(price) && price >= 0) sum += price * it.quantity;
    }
    return sum;
  }, [rfq.items, prices]);

  const pricesFilled = useMemo(() => {
    if (rfq.items.length === 0) return false;
    return rfq.items.every((it) => {
      const price = Number(prices.get(it.id));
      return Number.isFinite(price) && price >= 0 && prices.get(it.id) !== "";
    });
  }, [rfq.items, prices]);

  const canSubmit = vendorId && source && receivedDate && pricesFilled;

  async function handleSubmit() {
    if (!canSubmit || submitting || !receivedDate) return;
    setSubmitting(true);
    try {
      await quotesApi.enter(projectId, rfq.id, {
        vendorId,
        responseSource: source as (typeof RFQ_MANUAL_RESPONSE_SOURCES)[number],
        receivedDate: toIsoDate(receivedDate),
        currency: currency as (typeof QUOTE_CURRENCIES)[number],
        validUntil: validUntil ? toIsoDate(validUntil) : null,
        deliveryPeriod: deliveryPeriod || null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        attachments,
        items: rfq.items.map((it) => ({
          rfqItemId: it.id,
          unitPrice: Number(prices.get(it.id) ?? 0),
        })),
      });
      toast({ title: existing ? "Quote updated" : "Quote recorded" });
      onEntered();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save quote",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enter quote</DialogTitle>
          <DialogDescription>
            {rfq.rfq_number} — {rfq.title}
          </DialogDescription>
        </DialogHeader>

        {/* -mx/px so the scroll container's overflow clip doesn't cut the edge
            fields' focus rings, while staying aligned with the header. */}
        <div className="max-h-[65vh] overflow-y-auto space-y-5 -mx-1.5 px-1.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LabeledSelect
              label="Vendor"
              value={vendorId}
              onChange={setVendorId}
              options={vendors.map((v) => ({
                value: v.vendor_id,
                label: v.vendor_name,
              }))}
              placeholder="Select a vendor"
            />
            <LabeledSelect
              label="Received via"
              value={source}
              onChange={setSource}
              options={RFQ_MANUAL_RESPONSE_SOURCES.map((s) => ({
                value: s,
                label: RESPONSE_SOURCE_LABELS[s],
                icon: RESPONSE_SOURCE_ICONS[s],
              }))}
            />
            <DatePicker
              label="Received date"
              value={receivedDate}
              onChange={setReceivedDate}
            />
          </div>

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
                      ? price * it.quantity
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
                    Grand total ({currency})
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
            <LabeledSelect
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={QUOTE_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
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
              placeholder="e.g. 50% advance"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              maxLength={100}
            />
            <div className="md:col-span-2">
              <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
                maxLength={10000}
              />
            </div>
          </div>

          {/* Evidence — the emailed PDF / screenshot / scanned quote. */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-text-secondary">
              Evidence
            </label>
            <AttachmentsEditor
              value={attachments}
              onChange={setAttachments}
              removeLabel="Remove"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existing ? "Update quote" : "Save quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
