"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/FormDialog";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import type { BoqSection } from "@/types";
import type { ElementUnit } from "@/lib/validations";
import { BOQ_NO_SECTION_ID } from "../_lib/formatters";
import { BoqSectionSelect } from "./BoqSectionSelect";

const DEFAULT_UNIT: ElementUnit = "no";

interface BoqCreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  sections: BoqSection[];
  /** Pre-selected section (e.g., opened from a section's menu). */
  defaultSectionId?: string | null;
}

/**
 * Add a manual line item. For element-library picks, 5D provides a separate
 * drawer flow — this dialog covers the "quick entry" case.
 */
export function BoqCreateItemDialog({
  open,
  onOpenChange,
  projectId,
  boqId,
  sections,
  defaultSectionId,
}: BoqCreateItemDialogProps) {
  const { createItem } = useBoqMutations(projectId);
  const [sectionId, setSectionId] = useState<string>(
    defaultSectionId ?? BOQ_NO_SECTION_ID
  );
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<ElementUnit>(DEFAULT_UNIT);
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [serviceChargePct, setServiceChargePct] = useState("0");
  const [marginPct, setMarginPct] = useState("15");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSectionId(defaultSectionId ?? BOQ_NO_SECTION_ID);
    setDescription("");
    setUnit(DEFAULT_UNIT);
    setQuantity("1");
    setUnitCost("0");
    setServiceChargePct("0");
    setMarginPct("15");
  }, [open, defaultSectionId]);

  const parseNum = (v: string, fallback: number) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      toast({
        title: "Description required",
        description: "Describe the line item.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      await createItem({
        boqId,
        sectionId: sectionId === BOQ_NO_SECTION_ID ? null : sectionId,
        description: trimmedDesc,
        unit,
        quantity: parseNum(quantity, 1),
        unitCost: parseNum(unitCost, 0),
        serviceChargePct: parseNum(serviceChargePct, 0),
        marginPct: parseNum(marginPct, 15),
      });
      toast({ title: "Item added", variant: "success" });
      onOpenChange(false);
    } catch {
      // useBoqMutations already toasts.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add line item"
      description="Enter a manual line. Sell price, subtotal, and margin alerts are computed server-side."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Add item"
      submittingLabel="Adding..."
    >
      <BoqSectionSelect
        value={sectionId}
        onChange={setSectionId}
        sections={sections}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">
          Description
        </span>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          required
          autoFocus
          placeholder="e.g. Concrete footing M25"
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <UnitSelect value={unit} onChange={setUnit} label="Unit" required />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">Qty</span>
          <Input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">
            Unit cost
          </span>
          <Input
            type="number"
            min="0"
            step="any"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">
            Service charge %
          </span>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={serviceChargePct}
            onChange={(e) => setServiceChargePct(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">
            Margin %
          </span>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={marginPct}
            onChange={(e) => setMarginPct(e.target.value)}
          />
        </label>
      </div>
    </FormDialog>
  );
}
