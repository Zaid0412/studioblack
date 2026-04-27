"use client";

import type { BoqSummary } from "@/types";
import { formatCurrency, formatPct, toNum } from "../_lib/formatters";

interface BoqBottomBarProps {
  summary: BoqSummary;
  contingencyPct: string;
  vatPct: string;
  currency: string;
}

/** Totals strip under the BOQ table: subtotal, contingency, VAT, and the final client total. */
export function BoqBottomBar({
  summary,
  contingencyPct,
  vatPct,
  currency,
}: BoqBottomBarProps) {
  const subtotal = toNum(summary.subtotal);
  const preVat = toNum(summary.pre_vat_total);
  const clientTotal = toNum(summary.client_total);
  const contingencyAmount = preVat - subtotal;
  const vatAmount = clientTotal - preVat;

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary px-5 py-4 flex flex-wrap items-center justify-end gap-x-8 gap-y-2 text-sm">
      <Row label="Subtotal" value={formatCurrency(subtotal, currency)} />
      <Row
        label={`Contingency (${formatPct(contingencyPct)})`}
        value={formatCurrency(contingencyAmount, currency)}
      />
      <Row label="Pre-VAT" value={formatCurrency(preVat, currency)} />
      <Row
        label={`VAT (${formatPct(vatPct)})`}
        value={formatCurrency(vatAmount, currency)}
      />
      <Row
        label="Client Total"
        value={formatCurrency(clientTotal, currency)}
        emphasis
      />
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-base font-semibold text-text-primary"
            : "text-sm text-text-primary"
        }
      >
        {value}
      </span>
    </div>
  );
}
