"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { FormDialog } from "@/components/ui/FormDialog";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { ApiError } from "@/lib/api";

interface BoqCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultTitle: string;
  onCreated?: () => void;
}

/**
 * First-time BOQ creation dialog. Shown from the BOQ-tab empty state when
 * `GET /boq` returns 404. Lets the PM set title, currency, contingency,
 * VAT, and minimum margin before the BOQ is created.
 */
export function BoqCreateDialog({
  open,
  onOpenChange,
  projectId,
  defaultTitle,
  onCreated,
}: BoqCreateDialogProps) {
  const { createBoq } = useBoqMutations(projectId);
  const [title, setTitle] = useState(defaultTitle);
  const [currency, setCurrency] = useState("USD");
  const [contingencyPct, setContingencyPct] = useState("5");
  const [vatPct, setVatPct] = useState("0");
  const [minimumMarginPct, setMinimumMarginPct] = useState("10");
  const [submitting, setSubmitting] = useState(false);

  const parsePct = (v: string): number | undefined => {
    const n = parseFloat(v);
    return isFinite(n) && n >= 0 ? n : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast({
        title: "Title required",
        description: "Give the BOQ a short title.",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      await createBoq({
        title: trimmed,
        currency,
        contingencyPct: parsePct(contingencyPct),
        vatPct: parsePct(vatPct),
        minimumMarginPct: parsePct(minimumMarginPct),
      });
      toast({ title: "BOQ created", variant: "success" });
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not create BOQ",
        description:
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create BOQ"
      description="Bill of Quantities for this project. You can edit these settings later."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Create BOQ"
      submittingLabel="Creating..."
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Title</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">
          Currency
        </span>
        <CurrencySelect value={currency} onChange={setCurrency} />
      </label>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Contingency %",
            value: contingencyPct,
            onChange: setContingencyPct,
          },
          { label: "VAT %", value: vatPct, onChange: setVatPct },
          {
            label: "Min margin %",
            value: minimumMarginPct,
            onChange: setMinimumMarginPct,
          },
        ].map((field) => (
          <label key={field.label} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {field.label}
            </span>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            />
          </label>
        ))}
      </div>
    </FormDialog>
  );
}
