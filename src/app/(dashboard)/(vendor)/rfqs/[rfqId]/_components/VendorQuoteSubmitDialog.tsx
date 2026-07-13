"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  AttachmentsEditor,
  type AttachmentRef,
} from "@/components/ui/AttachmentsEditor";
import { formatDate, fromIsoDate } from "@/lib/formatDate";
import { isPriceFilled } from "@/lib/quoteTotal";
import { serializeQuoteDraft } from "@/lib/quoteDraft";
import type { RfqItem, RfqWithItems, VendorQuoteWithItems } from "@/types";
import type { QuoteCurrency } from "@/lib/validations";

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
  currency?: QuoteCurrency;
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
  attachments?: AttachmentRef[];
}

/**
 * Vendor quote submission / revision form. Pre-fills from `existing` when
 * the vendor has already submitted. Partial bids are allowed (§14): a vendor
 * may price some items and leave others blank ("not quoting"). Submission is
 * blocked client-side until at least one item has a non-negative price; only
 * filled lines are sent.
 */
export function VendorQuoteSubmitDialog({
  rfq,
  existing,
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("vendorPortal.quote");
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
    fromIsoDate(existing?.valid_until)
  );
  const [deliveryPeriod, setDeliveryPeriod] = useState(
    existing?.delivery_period ?? ""
  );
  const [paymentTerms, setPaymentTerms] = useState(
    existing?.payment_terms ?? ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [attachments, setAttachments] = useState<AttachmentRef[]>(
    existing?.attachments ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  // Snapshot of the pre-filled form when revising, so a no-op save is blocked.
  const [baseline, setBaseline] = useState<string | null>(null);

  // Reset form whenever the dialog opens with a different state.
  useEffect(() => {
    if (!open) return;
    const initValidUntil = existing?.valid_until
      ? new Date(`${existing.valid_until}T00:00:00`)
      : undefined;
    const initDelivery = existing?.delivery_period ?? "";
    const initPayment = existing?.payment_terms ?? "";
    const initNotes = existing?.notes ?? "";
    const initAttachments = existing?.attachments ?? [];

    setPrices(initialPrices);
    setValidUntil(initValidUntil);
    setDeliveryPeriod(initDelivery);
    setPaymentTerms(initPayment);
    setNotes(initNotes);
    setAttachments(initAttachments);

    setBaseline(
      existing
        ? serializeQuoteDraft({
            validUntil: initValidUntil
              ? initValidUntil.toISOString().slice(0, 10)
              : null,
            deliveryPeriod: initDelivery,
            paymentTerms: initPayment,
            notes: initNotes,
            prices: rfq.items.map((it) => {
              const raw = initialPrices.get(it.id) ?? "";
              return isPriceFilled(raw) ? Number(raw) : null;
            }),
            attachments: initAttachments,
          })
        : null
    );
  }, [open, existing, initialPrices, rfq.items]);

  const isLate = useMemo(() => {
    if (!rfq.response_deadline) return false;
    return new Date() > new Date(`${rfq.response_deadline}T23:59:59`);
  }, [rfq.response_deadline]);

  // The RFQ itself carries no currency — only a submitted quote does. For a
  // fresh submission there's nothing to read yet, so fall back to the same
  // default the API applies server-side (see quote schema in lib/validations).
  const currency = existing?.currency ?? DEFAULT_CURRENCY;

  const grandTotal = useMemo(() => {
    let sum = 0;
    for (const it of rfq.items) {
      const raw = prices.get(it.id);
      if (isPriceFilled(raw)) sum += Number(raw) * Number(it.quantity);
    }
    return sum;
  }, [rfq.items, prices]);

  // A blank line means "not quoting" this item (§14 partial bidding). Only
  // filled lines are sent, and at least one is required to submit.
  const isFilled = (id: string) => isPriceFilled(prices.get(id));
  const hasAnyPrice = rfq.items.some((it) => isFilled(it.id));

  // Serialise the live form the same way as the baseline; a revision is only
  // saveable once something actually differs from the quote being revised.
  const current = useMemo(
    () =>
      serializeQuoteDraft({
        validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
        deliveryPeriod,
        paymentTerms,
        notes,
        prices: rfq.items.map((it) => {
          const raw = prices.get(it.id) ?? "";
          return isPriceFilled(raw) ? Number(raw) : null;
        }),
        attachments,
      }),
    [
      validUntil,
      deliveryPeriod,
      paymentTerms,
      notes,
      prices,
      attachments,
      rfq.items,
    ]
  );
  const isDirty = !existing || (baseline !== null && current !== baseline);

  // Explains why Submit/Save is disabled — shown only while the button is
  // disabled.
  const disabledHint = !hasAnyPrice
    ? t("hintMissingPrice")
    : !isDirty
      ? t("hintNoChanges")
      : null;

  async function handleSubmit() {
    if (!hasAnyPrice || submitting || !isDirty) return;
    setSubmitting(true);
    try {
      await onSubmit({
        validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
        deliveryPeriod: deliveryPeriod || null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        items: rfq.items
          .filter((it) => isFilled(it.id))
          .map((it) => ({
            rfqItemId: it.id,
            unitPrice: Number(prices.get(it.id)),
          })),
        attachments,
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
            {existing ? t("titleRevise") : t("titleSubmit")}
          </DialogTitle>
          <DialogDescription>
            {rfq.rfq_number} — {rfq.title}
          </DialogDescription>
        </DialogHeader>

        {isLate && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text-primary">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-warning" />
            <div>
              <p className="font-medium">{t("lateBadgeTitle")}</p>
              <p className="text-text-secondary">
                {t("lateBadgeDescription", {
                  deadline: formatDate(rfq.response_deadline!),
                })}
              </p>
            </div>
          </div>
        )}

        {/* Partial bidding (§14): pricing some lines and leaving others
            blank is expected — call it out once, above the table. This
            matters most here since the vendor has the least context. */}
        <p className="text-xs text-text-muted">{t("partialBiddingHint")}</p>

        <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          <div className="overflow-x-auto rounded-md border border-border-default">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated text-text-muted">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">{t("col.item")}</th>
                  <th className="px-3 py-2 font-medium">{t("col.unit")}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {t("col.qty")}
                  </th>
                  <th className="px-3 py-2 font-medium text-right w-36">
                    {t("col.unitPrice", { currency })}
                  </th>
                  <th className="px-3 py-2 font-medium text-right w-28">
                    {t("col.total")}
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
                        {raw === "" && (
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {t("notQuoting")}
                          </div>
                        )}
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
                    {t("grandTotal", { currency })}
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
              label={t("validUntilLabel")}
              value={validUntil}
              onChange={setValidUntil}
              placeholder={t("optionalPlaceholder")}
            />
            <Input
              label={t("deliveryPeriodLabel")}
              placeholder={t("deliveryPeriodPlaceholder")}
              value={deliveryPeriod}
              onChange={(e) => setDeliveryPeriod(e.target.value)}
              maxLength={100}
            />
            <Input
              label={t("paymentTermsLabel")}
              placeholder={t("paymentTermsPlaceholder")}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              maxLength={100}
            />
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-text-muted mb-1.5 block">
                {t("notesLabel")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("notesPlaceholder")}
                className="w-full rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-text-muted mb-1.5 block">
                {t("evidenceLabel")}
              </label>
              <p className="text-xs text-text-muted mb-2">
                {t("evidenceHint")}
              </p>
              <AttachmentsEditor
                value={attachments}
                onChange={setAttachments}
                removeLabel={t("removeAttachment")}
                withNotes
                notesPlaceholder={t("attachmentNotePlaceholder")}
              />
            </div>
          </div>
        </div>

        {disabledHint && (
          <p className="text-xs text-text-muted text-right -mb-1">
            {disabledHint}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="cursor-pointer">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!hasAnyPrice || submitting || !isDirty}
            className="cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existing ? t("saveRevision") : t("titleSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
