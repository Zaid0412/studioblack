"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Plus, X, Save } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TagInput } from "@/components/ui/TagInput";
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { toast } from "@/components/ui/useToast";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { elements as elementsApi, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type { BoqSection, ElementCategoryNode } from "@/types";
import type { ElementUnit } from "@/lib/validations";
import { CategorySelect } from "@/app/(dashboard)/elements/_components/CategorySelect";
import { BOQ_NO_SECTION_ID, parseOptionalNumber } from "../_lib/formatters";
import { BoqSectionSelect } from "./BoqSectionSelect";

const DEFAULT_UNIT: ElementUnit = "no";

interface Attribute {
  attribute_key: string;
  attribute_value: string;
  unit?: string;
}

interface FormState {
  imageUrl: string | null;
  itemCode: string;
  name: string;
  sectionId: string;
  description: string;
  unit: ElementUnit;
  currency: string;
  quantity: string;
  unitCost: string;
  marginPct: string;
  materialCost: string;
  labourCost: string;
  overheadPct: string;
  serviceChargePct: string;
  clientRate: string;
  budgetRate: string;
  specReference: string;
  drawingRef: string;
  drawingFileUrl: string | null;
  drawingFileName: string | null;
  specFileUrl: string | null;
  specFileName: string | null;
  tags: string[];
  attributes: Attribute[];
  notes: string;
  saveAsElement: boolean;
  saveCategoryId: string | null;
}

const INITIAL: FormState = {
  imageUrl: null,
  itemCode: "",
  name: "",
  sectionId: BOQ_NO_SECTION_ID,
  description: "",
  unit: DEFAULT_UNIT,
  currency: "USD",
  quantity: "1",
  unitCost: "0",
  marginPct: "15",
  materialCost: "",
  labourCost: "",
  overheadPct: "0",
  serviceChargePct: "0",
  clientRate: "",
  budgetRate: "",
  specReference: "",
  drawingRef: "",
  drawingFileUrl: null,
  drawingFileName: null,
  specFileUrl: null,
  specFileName: null,
  tags: [],
  attributes: [],
  notes: "",
  saveAsElement: false,
  saveCategoryId: null,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  sections: BoqSection[];
  /** Pre-selected section (e.g., opened from a section's menu). */
  defaultSectionId?: string | null;
}

/**
 * Add a manual BoQ line. All element fields are exposed so the user can
 * optionally promote the line to the element library via the sticky
 * "Save to element library" toggle at the bottom.
 *
 * - Toggle OFF: only `boq_item`-mapped fields persist; element-only
 *   fields (image, name, category, currency, refs, files, tags,
 *   attributes) are silently ignored.
 * - Toggle ON: a new `element` row is created first, then the
 *   `boq_item` is inserted with `element_id` linking back to it.
 */
export function BoqCreateItemSheet({
  open,
  onOpenChange,
  projectId,
  boqId,
  sections,
  defaultSectionId,
}: Props) {
  const { createItem } = useBoqMutations(projectId);
  const [v, setV] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    open ? API.elementCategories() : null
  );
  const categoryTree = catData?.tree ?? [];

  useEffect(() => {
    if (!open) return;
    setV({
      ...INITIAL,
      sectionId: defaultSectionId ?? BOQ_NO_SECTION_ID,
    });
  }, [open, defaultSectionId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const addAttribute = () =>
    setV((prev) => ({
      ...prev,
      attributes: [
        ...prev.attributes,
        { attribute_key: "", attribute_value: "", unit: undefined },
      ],
    }));

  const removeAttribute = (i: number) =>
    setV((prev) => ({
      ...prev,
      attributes: prev.attributes.filter((_, idx) => idx !== i),
    }));

  const setAttribute = (i: number, patch: Partial<Attribute>) =>
    setV((prev) => ({
      ...prev,
      attributes: prev.attributes.map((a, idx) =>
        idx === i ? { ...a, ...patch } : a
      ),
    }));

  const num = (s: string, fallback: number) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesc = v.description.trim();
    const trimmedName = v.name.trim();
    const trimmedCode = v.itemCode.trim();

    if (!trimmedDesc) {
      toast({
        title: "Description required",
        description: "Describe the line item.",
        variant: "error",
      });
      return;
    }

    if (v.saveAsElement) {
      if (!trimmedName) {
        toast({
          title: "Name required",
          description: "A name is required to save as an element.",
          variant: "error",
        });
        return;
      }
      if (!trimmedCode) {
        toast({
          title: "Code required",
          description: "An element code is required to save to the library.",
          variant: "error",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      let elementId: string | null = null;

      if (v.saveAsElement) {
        const element = await elementsApi.create({
          code: trimmedCode,
          name: trimmedName,
          description: trimmedDesc,
          categoryId: v.saveCategoryId ?? undefined,
          unit: v.unit,
          unitCost: num(v.unitCost, 0),
          currency: v.currency,
          materialCost: parseOptionalNumber(v.materialCost.trim()) ?? undefined,
          labourCost: parseOptionalNumber(v.labourCost.trim()) ?? undefined,
          overheadPct: num(v.overheadPct, 0),
          serviceChargePct: num(v.serviceChargePct, 0),
          marginPct: num(v.marginPct, 15),
          clientRate: parseOptionalNumber(v.clientRate.trim()),
          budgetRate: parseOptionalNumber(v.budgetRate.trim()),
          specReference: v.specReference.trim() || undefined,
          drawingRef: v.drawingRef.trim() || undefined,
          tags: v.tags,
          attributes: v.attributes.filter(
            (a) => a.attribute_key && a.attribute_value
          ),
          imageUrl: v.imageUrl,
          drawingFileUrl: v.drawingFileUrl,
          drawingFileName: v.drawingFileName,
          specFileUrl: v.specFileUrl,
          specFileName: v.specFileName,
        });
        elementId = element.id;
      }

      await createItem({
        boqId,
        sectionId: v.sectionId === BOQ_NO_SECTION_ID ? null : v.sectionId,
        elementId,
        itemCode: trimmedCode || undefined,
        description: trimmedDesc,
        unit: v.unit,
        quantity: num(v.quantity, 1),
        unitCost: num(v.unitCost, 0),
        materialCost: parseOptionalNumber(v.materialCost.trim()),
        labourCost: parseOptionalNumber(v.labourCost.trim()),
        overheadPct: num(v.overheadPct, 0),
        serviceChargePct: num(v.serviceChargePct, 0),
        marginPct: num(v.marginPct, 15),
        clientRate: parseOptionalNumber(v.clientRate.trim()),
        budgetRate: parseOptionalNumber(v.budgetRate.trim()),
        notes: v.notes.trim() || null,
      });

      toast({
        title: v.saveAsElement ? "Item added & saved to library" : "Item added",
        variant: "success",
      });
      onOpenChange(false);
    } catch (err) {
      // useBoqMutations toasts on its own boq error path; toast here
      // when the failure happened during element creation.
      if (err instanceof ApiError) {
        toast({
          title: "Could not save",
          description: err.message,
          variant: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "text-xs font-medium text-text-secondary";
  const requiredAsterisk = (
    <span className="text-danger" aria-hidden>
      *
    </span>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Add line item</SheetTitle>
          <SheetDescription>
            Enter a manual line. Sell price, subtotal, and margin alerts are
            computed server-side.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <SheetBody className="flex flex-col gap-4">
            {/* Identity row: Image + (Code | Name) */}
            <div className="flex flex-col md:flex-row gap-4">
              <FileUploadSlot
                variant="image"
                label="Image"
                url={v.imageUrl}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onUploaded={({ url }) => set("imageUrl", url)}
                onCleared={() => set("imageUrl", null)}
              />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 self-start">
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>
                    Item code{v.saveAsElement && requiredAsterisk}
                  </span>
                  <Input
                    value={v.itemCode}
                    onChange={(e) => set("itemCode", e.target.value)}
                    maxLength={50}
                    placeholder={
                      v.saveAsElement ? "e.g. FIN-001" : "auto-generated"
                    }
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>
                    Name{v.saveAsElement && requiredAsterisk}
                  </span>
                  <Input
                    value={v.name}
                    onChange={(e) => set("name", e.target.value)}
                    maxLength={255}
                    placeholder="Short, reusable label"
                  />
                </label>
              </div>
            </div>

            {/* Section */}
            <BoqSectionSelect
              value={v.sectionId}
              onChange={(next) => set("sectionId", next)}
              sections={sections}
            />

            {/* Description */}
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Description{requiredAsterisk}</span>
              <textarea
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                required
                maxLength={500}
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                placeholder="e.g. Concrete footing M25"
              />
            </label>

            {/* Unit | Currency */}
            <div className="grid grid-cols-2 gap-3">
              <UnitSelect
                label="Unit"
                value={v.unit}
                onChange={(u) => set("unit", u)}
                required
              />
              <CurrencySelect
                label="Currency"
                value={v.currency}
                onChange={(c) => set("currency", c)}
                required
              />
            </div>

            {/* Qty | Unit cost * | Margin % */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Qty</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={v.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Unit cost{requiredAsterisk}</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={v.unitCost}
                  onChange={(e) => set("unitCost", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Margin %</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.marginPct}
                  onChange={(e) => set("marginPct", e.target.value)}
                />
              </label>
            </div>

            {/* Material | Labour | Overhead % */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Material cost</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="optional"
                  value={v.materialCost}
                  onChange={(e) => set("materialCost", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Labour cost</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="optional"
                  value={v.labourCost}
                  onChange={(e) => set("labourCost", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Overhead %</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.overheadPct}
                  onChange={(e) => set("overheadPct", e.target.value)}
                />
              </label>
            </div>

            {/* Service charge % | Client rate | Budget rate */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Service charge %</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.serviceChargePct}
                  onChange={(e) => set("serviceChargePct", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Client rate</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="optional"
                  value={v.clientRate}
                  onChange={(e) => set("clientRate", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Budget rate</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="optional"
                  value={v.budgetRate}
                  onChange={(e) => set("budgetRate", e.target.value)}
                />
              </label>
            </div>

            {/* Spec ref | Drawing ref */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Spec reference</span>
                <Input
                  value={v.specReference}
                  onChange={(e) => set("specReference", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. SPEC-204"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Drawing reference</span>
                <Input
                  value={v.drawingRef}
                  onChange={(e) => set("drawingRef", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. A-101 / Detail 4"
                />
              </label>
            </div>

            {/* Drawing file | Spec file */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FileUploadSlot
                variant="file"
                label="Drawing file"
                url={v.drawingFileUrl}
                fileName={v.drawingFileName}
                accept=".pdf,.dwg,.dxf,.skp,.png,.jpg,.jpeg,.webp"
                onUploaded={({ url, fileName }) => {
                  set("drawingFileUrl", url);
                  set("drawingFileName", fileName);
                }}
                onCleared={() => {
                  set("drawingFileUrl", null);
                  set("drawingFileName", null);
                }}
              />
              <FileUploadSlot
                variant="file"
                label="Spec file"
                url={v.specFileUrl}
                fileName={v.specFileName}
                accept=".pdf,.doc,.docx,.txt"
                onUploaded={({ url, fileName }) => {
                  set("specFileUrl", url);
                  set("specFileName", fileName);
                }}
                onCleared={() => {
                  set("specFileUrl", null);
                  set("specFileName", null);
                }}
              />
            </div>

            {/* Tags */}
            <TagInput
              label="Tags"
              placeholder="Add tag…"
              value={v.tags}
              onChange={(tags) => set("tags", tags)}
            />

            {/* Attributes */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={labelCls}>Attributes</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addAttribute}
                >
                  <Plus className="w-4 h-4" />
                  Add attribute
                </Button>
              </div>
              {v.attributes.map((attr, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center"
                >
                  <Input
                    placeholder="key"
                    value={attr.attribute_key}
                    onChange={(e) =>
                      setAttribute(i, { attribute_key: e.target.value })
                    }
                  />
                  <Input
                    placeholder="value"
                    value={attr.attribute_value}
                    onChange={(e) =>
                      setAttribute(i, { attribute_value: e.target.value })
                    }
                  />
                  <Input
                    placeholder="unit"
                    value={attr.unit ?? ""}
                    onChange={(e) =>
                      setAttribute(i, { unit: e.target.value || undefined })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttribute(i)}
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Notes */}
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Notes</span>
              <textarea
                value={v.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                placeholder="Internal note (not shown to client)…"
              />
            </label>
          </SheetBody>

          {/* Sticky bottom band: save-as-element panel + footer share bg-elevated */}
          <div className="bg-bg-elevated border-t border-border-default">
            <div className="flex flex-col gap-3 px-6 py-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={v.saveAsElement}
                  onCheckedChange={(checked) => set("saveAsElement", checked)}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-text-primary">
                    Also save to element library
                  </span>
                  <span className="text-[11px] text-text-muted leading-relaxed">
                    Creates a reusable element so you can add this line to other
                    BoQs.
                  </span>
                </div>
              </div>
              {v.saveAsElement && (
                <div className="pl-7">
                  <CategorySelect
                    label="Save under category"
                    value={v.saveCategoryId}
                    onChange={(id) => set("saveCategoryId", id)}
                    tree={categoryTree}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-row justify-end gap-2 px-6 py-3">
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={submitting}>
                {v.saveAsElement ? (
                  <>
                    <Save className="w-4 h-4" />
                    {submitting ? "Saving…" : "Add item & save element"}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {submitting ? "Adding…" : "Add item"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
