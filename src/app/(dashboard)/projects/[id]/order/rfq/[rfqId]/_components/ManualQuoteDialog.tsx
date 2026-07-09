"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  AttachmentsEditor,
  type AttachmentRef,
} from "@/components/ui/AttachmentsEditor";
import { toast } from "@/components/ui/useToast";
import { quotes as quotesApi } from "@/lib/api";
import { isPriceFilled } from "@/lib/quoteTotal";
import { serializeQuoteDraft } from "@/lib/quoteDraft";
import { toIsoDate, fromIsoDate } from "@/lib/formatDate";
import {
  RFQ_MANUAL_RESPONSE_SOURCES,
  QUOTE_CURRENCIES,
} from "@/lib/validations";
import { RESPONSE_SOURCE_ICONS, RESPONSE_SOURCE_LABELS } from "@/lib/rfqLabels";
import type { RfqItem, RfqWithItems, VendorQuoteWithItems } from "@/types";

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
  const t = useTranslations("rfq.quoteEntry");
  const [vendorId, setVendorId] = useState(preselectedVendorId ?? "");
  const [source, setSource] = useState<string>("email");
  const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined);
  const [currency, setCurrency] = useState<string>("USD");
  const [prices, setPrices] = useState<Map<string, string>>(new Map());
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined);
  const [deliveryPeriod, setDeliveryPeriod] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Snapshot of the pre-filled form when revising, so a no-op save is blocked.
  const [baseline, setBaseline] = useState<string | null>(null);

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
    const initCurrency = existing?.currency ?? "USD";
    const initDelivery = existing?.delivery_period ?? "";
    const initPayment = existing?.payment_terms ?? "";
    const initNotes = existing?.notes ?? "";
    const initValidUntil = fromIsoDate(existing?.valid_until);
    const initReceived = fromIsoDate(existing?.received_date) ?? new Date();
    const initSource =
      existing && existing.response_source !== "portal"
        ? existing.response_source
        : "email";
    const initAttachments = existing?.attachments ?? [];

    setPrices(map);
    setCurrency(initCurrency);
    setDeliveryPeriod(initDelivery);
    setPaymentTerms(initPayment);
    setNotes(initNotes);
    setValidUntil(initValidUntil);
    setReceivedDate(initReceived);
    setSource(initSource);
    setAttachments(initAttachments);

    setBaseline(
      existing
        ? serializeQuoteDraft({
            source: initSource,
            receivedDate: toIsoDate(initReceived),
            currency: initCurrency,
            validUntil: initValidUntil ? toIsoDate(initValidUntil) : null,
            deliveryPeriod: initDelivery,
            paymentTerms: initPayment,
            notes: initNotes,
            prices: rfq.items.map((it) => {
              const raw = map.get(it.id) ?? "";
              return isPriceFilled(raw) ? Number(raw) : null;
            }),
            attachments: initAttachments,
          })
        : null
    );
  }, [open, vendorId, existing, rfq.items]);

  const grandTotal = useMemo(() => {
    let sum = 0;
    for (const it of rfq.items) {
      const raw = prices.get(it.id);
      if (isPriceFilled(raw)) sum += Number(raw) * it.quantity;
    }
    return sum;
  }, [rfq.items, prices]);

  // A blank line means "not quoting" this item (§14 partial bidding) — only
  // filled lines are submitted, and at least one is required.
  const isFilled = (id: string) => isPriceFilled(prices.get(id));
  const hasAnyPrice = rfq.items.some((it) => isFilled(it.id));

  // Serialise the live form the same way as the baseline; a revision is only
  // saveable once something actually differs from the quote being revised.
  const current = useMemo(
    () =>
      serializeQuoteDraft({
        source,
        receivedDate: receivedDate ? toIsoDate(receivedDate) : null,
        currency,
        validUntil: validUntil ? toIsoDate(validUntil) : null,
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
      source,
      receivedDate,
      currency,
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

  const canSubmit =
    vendorId && source && receivedDate && hasAnyPrice && isDirty;

  // Explains why Save is disabled — shown only while the button is disabled.
  const disabledHint =
    vendorId && source && receivedDate && hasAnyPrice && !isDirty
      ? t("hintNoChanges")
      : !canSubmit
        ? t("hintMissingFields")
        : null;

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
        items: rfq.items
          .filter((it) => isFilled(it.id))
          .map((it) => ({
            rfqItemId: it.id,
            unitPrice: Number(prices.get(it.id)),
          })),
      });
      toast({
        title: existing ? t("revisionSavedToast") : t("quoteRecordedToast"),
      });
      onEntered();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t("saveFailedToast"),
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
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {rfq.rfq_number} — {rfq.title}
          </DialogDescription>
        </DialogHeader>

        {/* -mx/px so the scroll container's overflow clip doesn't cut the edge
            fields' focus rings, while staying aligned with the header. */}
        <div className="max-h-[65vh] overflow-y-auto space-y-5 -mx-1.5 px-1.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LabeledSelect
              label={t("vendorLabel")}
              value={vendorId}
              onChange={setVendorId}
              options={vendors.map((v) => ({
                value: v.vendor_id,
                label: v.vendor_name,
              }))}
              placeholder={t("vendorPlaceholder")}
            />
            <LabeledSelect
              label={t("receivedViaLabel")}
              value={source}
              onChange={setSource}
              options={RFQ_MANUAL_RESPONSE_SOURCES.map((s) => ({
                value: s,
                label: RESPONSE_SOURCE_LABELS[s],
                icon: RESPONSE_SOURCE_ICONS[s],
              }))}
            />
            <DatePicker
              label={t("receivedDateLabel")}
              value={receivedDate}
              onChange={setReceivedDate}
            />
          </div>

          {/* Partial bidding (§14): pricing some lines and leaving others
              blank is expected — call it out once, above the table. */}
          <p className="text-xs text-text-muted -mb-1">
            {t("partialBiddingHint")}
          </p>

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
                    {t("col.unitPrice")}
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
            <LabeledSelect
              label={t("currencyLabel")}
              value={currency}
              onChange={setCurrency}
              options={QUOTE_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
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
              <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
                {t("notesLabel")}
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
              {t("evidenceLabel")}
            </label>
            <p className="text-xs text-text-muted -mt-1">{t("evidenceHint")}</p>
            <AttachmentsEditor
              value={attachments}
              onChange={setAttachments}
              removeLabel={t("removeAttachment")}
              withNotes
              notesPlaceholder={t("attachmentNotePlaceholder")}
            />
          </div>
        </div>

        {disabledHint && (
          <p className="text-xs text-text-muted text-right -mb-1">
            {disabledHint}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t("cancel")}</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existing ? t("saveRevision") : t("saveQuote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
