"use client";

import { useEffect, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import type { BoqSummary } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { formatCurrency, formatPct, toNum } from "../_lib/formatters";

interface BoqBottomBarProps {
  projectId: string;
  boqId: string;
  summary: BoqSummary;
  contingencyPct: string;
  vatPct: string;
  currency: string;
  /** PM / architect can edit the contingency & VAT rates; clients see read-only. */
  canEdit: boolean;
}

/** Totals strip under the BOQ table: subtotal, contingency, VAT, and the final client total. */
export function BoqBottomBar({
  projectId,
  boqId,
  summary,
  contingencyPct,
  vatPct,
  currency,
  canEdit,
}: BoqBottomBarProps) {
  const subtotal = toNum(summary.subtotal);
  const preVat = toNum(summary.pre_vat_total);
  const clientTotal = toNum(summary.client_total);
  const contingencyAmount = preVat - subtotal;
  const vatAmount = clientTotal - preVat;

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary px-5 py-4 flex flex-wrap items-center justify-end gap-x-8 gap-y-2 text-sm">
      {canEdit && (
        <RateSettings
          projectId={projectId}
          boqId={boqId}
          contingencyPct={contingencyPct}
          vatPct={vatPct}
        />
      )}
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

/** Parse a percentage input to 0–100, or null when invalid. */
function parsePct(v: string): number | null {
  const n = Number(v.trim());
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/**
 * Pencil-triggered popover to edit the Contingency and VAT rates. Saving patches
 * the BOQ header; `updateBoq` refetches the BOQ so the totals recompute.
 */
function RateSettings({
  projectId,
  boqId,
  contingencyPct,
  vatPct,
}: {
  projectId: string;
  boqId: string;
  contingencyPct: string;
  vatPct: string;
}) {
  const { updateBoq } = useBoqMutations(projectId);
  const [open, setOpen] = useState(false);
  const [contingency, setContingency] = useState(contingencyPct);
  const [vat, setVat] = useState(vatPct);
  const [saving, setSaving] = useState(false);

  // Reseed from the live values whenever the popover opens.
  useEffect(() => {
    if (open) {
      setContingency(contingencyPct);
      setVat(vatPct);
    }
  }, [open, contingencyPct, vatPct]);

  const parsedContingency = parsePct(contingency);
  const parsedVat = parsePct(vat);
  const valid = parsedContingency !== null && parsedVat !== null;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await updateBoq({
        boqId,
        contingencyPct: parsedContingency,
        vatPct: parsedVat,
      });
      toast({ title: "Rates updated", variant: "success" });
      setOpen(false);
    } catch {
      // useBoqMutations already surfaced the error toast.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Edit contingency & VAT rates"
          title="Edit rates"
          className="mr-auto inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-64 p-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-text-primary">
            Client total rates
          </p>
          <PctField
            label="Contingency %"
            value={contingency}
            onChange={setContingency}
            invalid={parsedContingency === null}
          />
          <PctField
            label="VAT %"
            value={vat}
            onChange={setVat}
            invalid={parsedVat === null}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!valid || saving}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PctField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <Input
      label={label}
      type="number"
      min="0"
      max="100"
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
    />
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
