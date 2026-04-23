"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create BOQ</DialogTitle>
          <DialogDescription>
            Bill of Quantities for this project. You can edit these settings
            later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Title
            </span>
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
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Contingency %
              </span>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={contingencyPct}
                onChange={(e) => setContingencyPct(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                VAT %
              </span>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Min margin %
              </span>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={minimumMarginPct}
                onChange={(e) => setMinimumMarginPct(e.target.value)}
              />
            </label>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create BOQ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
