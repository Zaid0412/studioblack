"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Save } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEFAULT_CURRENCY } from "@/lib/constants";
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
import type { BoqSection } from "@/types";
import type { ElementUnit } from "@/lib/validations";
import {
  ServiceAreaField,
  useCategoryTree,
} from "@/components/elements/ServiceAreaField";
import {
  BOQ_NO_SECTION_ID,
  convertDimensions,
  formatFeetInches,
  parseDimensionValue,
  parseOptionalNumber,
  type DimensionUnit,
} from "../_lib/formatters";
import { BoqDimensionUnitToggle } from "./BoqDimensionUnitToggle";
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
  length: string;
  breadth: string;
  height: string;
  dimensionUnit: DimensionUnit;
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
  /**
   * Service area for the line (any tree level). Classifies the BOQ item so it
   * matches rate contracts / drives vendor suggestion even when it's free-text
   * (not saved to the library). Reused as the element's category when saving.
   */
  categoryId: string | null;
}

const INITIAL: FormState = {
  imageUrl: null,
  itemCode: "",
  name: "",
  sectionId: BOQ_NO_SECTION_ID,
  description: "",
  unit: DEFAULT_UNIT,
  currency: DEFAULT_CURRENCY,
  quantity: "1",
  unitCost: "0",
  marginPct: "15",
  materialCost: "",
  labourCost: "",
  overheadPct: "0",
  serviceChargePct: "0",
  clientRate: "",
  budgetRate: "",
  length: "",
  breadth: "",
  height: "",
  dimensionUnit: "m",
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
  categoryId: null,
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
  // Tracks whether the user has manually edited Qty in this session.
  // Once true, dimension edits stop overwriting Qty so a manual
  // override sticks for the rest of the session. Resets every time
  // the sheet opens.
  const [manualQty, setManualQty] = useState(false);

  const { isServiceAreaId } = useCategoryTree(open);
  const serviceAreaChosen = isServiceAreaId(v.categoryId);

  useEffect(() => {
    if (!open) return;
    setV({
      ...INITIAL,
      sectionId: defaultSectionId ?? BOQ_NO_SECTION_ID,
    });
    setManualQty(false);
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

  /**
   * Auto-fill string for the Qty field given the three dim inputs and unit.
   * Returns `null` when no dim is positive (Qty is left alone).
   *
   * In ft mode with exactly one positive dim the result is feet-inches
   * notation (`6'2"`) so Qty mirrors the dimension the user typed instead
   * of showing the raw decimal feet behind it (`6.166667`). With multiple
   * dims (area, volume) or in m mode, Qty stays a plain decimal — there's
   * no meaningful feet-inches form of an area or volume.
   */
  const autoFillQty = (
    unit: DimensionUnit,
    l: string,
    b: string,
    h: string
  ): string | null => {
    const positives = [l, b, h]
      .map((s) => parseDimensionValue(s, unit))
      .filter((n): n is number => n !== null && n > 0);
    if (positives.length === 0) return null;
    const product = positives.reduce((a, c) => a * c, 1);
    if (unit === "ft" && positives.length === 1) {
      return formatFeetInches(product);
    }
    return String(Number(product.toFixed(6)));
  };

  /**
   * Set a dimension and — unless the user has manually edited Qty
   * in this session — auto-fill `quantity` with the product of all
   * non-blank dimensions. Blanks are skipped. Once the user manually
   * overrides Qty, `manualQty` flips and further dimension edits leave
   * Qty alone (sticky-override).
   */
  const setDimension = (
    key: "length" | "breadth" | "height",
    value: string
  ) => {
    setV((prev) => {
      const next = { ...prev, [key]: value };
      if (manualQty) return next;
      const auto = autoFillQty(
        next.dimensionUnit,
        next.length,
        next.breadth,
        next.height
      );
      if (auto !== null) next.quantity = auto;
      return next;
    });
  };

  /**
   * Flip the form's dimension unit (option b: preserve the physical
   * measurement). Empty inputs stay empty — no `0'0"` noise.
   */
  const changeFormDimensionUnit = (next: DimensionUnit) => {
    setV((prev) => {
      if (next === prev.dimensionUnit) return prev;
      const converted = convertDimensions(
        prev.length || null,
        prev.breadth || null,
        prev.height || null,
        prev.dimensionUnit,
        next
      );
      const toStr = (n: number | null, original: string): string => {
        if (n === null) return original.trim() === "" ? "" : original;
        return next === "ft" ? formatFeetInches(n) : String(n);
      };
      const updated = {
        ...prev,
        dimensionUnit: next,
        length: toStr(converted.length, prev.length),
        breadth: toStr(converted.breadth, prev.breadth),
        height: toStr(converted.height, prev.height),
      };
      if (!manualQty) {
        const auto = autoFillQty(
          next,
          updated.length,
          updated.breadth,
          updated.height
        );
        if (auto !== null) updated.quantity = auto;
      }
      return updated;
    });
  };

  /**
   * Mark Qty as user-overridden so dimension edits stop touching it —
   * but only if the typed value actually differs from what the
   * auto-compute would produce. Typing the exact auto value (e.g.
   * `1.875` when L=2.5/B=1.5/H=0.5) doesn't count as an override and
   * leaves the `(auto from L × B × H)` label visible.
   */
  const setQtyManually = (value: string) => {
    setV((prev) => ({ ...prev, quantity: value }));
    const autoValue = autoFillQty(
      v.dimensionUnit,
      v.length,
      v.breadth,
      v.height
    );
    if (autoValue === null || value.trim() !== autoValue) {
      setManualQty(true);
    }
  };

  /** True when at least one dimension is filled and Qty hasn't been manually edited. */
  const qtyAutoFilled = useMemo(() => {
    if (manualQty) return false;
    return [v.length, v.breadth, v.height].some(
      (s) => (parseDimensionValue(s, v.dimensionUnit) ?? 0) > 0
    );
  }, [manualQty, v.length, v.breadth, v.height, v.dimensionUnit]);

  // ft mode lets the auto-filled `6'2"` notation be typed/edited in the
  // Qty field; m mode stays numeric for IME hints + native validation.
  const isFeetUnit = v.dimensionUnit === "ft";

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

    // Every line, not just the ones saved to the library.
    const categoryId = v.categoryId;
    if (!categoryId || !serviceAreaChosen) {
      toast({
        title: "Service Area required",
        description:
          "A BOQ line must sit under a Service Area — it's what matches it to rate contracts and vendors.",
        variant: "error",
      });
      return;
    }

    if (v.saveAsElement && !trimmedName) {
      toast({
        title: "Name required",
        description: "A name is required to save as an element.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      let elementId: string | null = null;

      if (v.saveAsElement) {
        const element = await elementsApi.create({
          name: trimmedName,
          description: trimmedDesc,
          categoryId,
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
        categoryId,
        itemCode: trimmedCode || undefined,
        // Persist even when `saveAsElement` is off — the BOQ item's own
        // `name` is what the drawer shows when there's no linked element.
        name: trimmedName || null,
        description: trimmedDesc,
        unit: v.unit,
        quantity: parseDimensionValue(v.quantity, v.dimensionUnit) ?? 1,
        unitCost: num(v.unitCost, 0),
        materialCost: parseOptionalNumber(v.materialCost.trim()),
        labourCost: parseOptionalNumber(v.labourCost.trim()),
        overheadPct: num(v.overheadPct, 0),
        serviceChargePct: num(v.serviceChargePct, 0),
        marginPct: num(v.marginPct, 15),
        clientRate: parseOptionalNumber(v.clientRate.trim()),
        budgetRate: parseOptionalNumber(v.budgetRate.trim()),
        length: parseDimensionValue(v.length, v.dimensionUnit),
        breadth: parseDimensionValue(v.breadth, v.dimensionUnit),
        height: parseDimensionValue(v.height, v.dimensionUnit),
        dimensionUnit: v.dimensionUnit,
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
          <SheetTitle>Add BOQ item</SheetTitle>
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
                  <span className={labelCls}>Item code</span>
                  <Input
                    value={v.itemCode}
                    onChange={(e) => set("itemCode", e.target.value)}
                    maxLength={50}
                    placeholder="auto-generated"
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
              projectId={projectId}
              boqId={boqId}
              nextSortOrder={sections.length}
            />

            {/* Required on every line, not just the ones going to the library:
                the Service Area is what makes a line match rate contracts and
                drive vendor suggestion, so an unclassified line silently gets
                neither. Lines added FROM the library inherit their element's. */}
            <ServiceAreaField
              label="Service area"
              value={v.categoryId}
              onChange={(id) => set("categoryId", id)}
              requiredHint="A BOQ line must sit under a Service Area"
              enabled={open}
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

            {/* Dimensions — optional, auto-fills Qty. Per-item unit (m / ft). */}
            <div className="flex flex-col gap-3 my-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">
                  Dimensions
                </span>
                <BoqDimensionUnitToggle
                  value={v.dimensionUnit}
                  onChange={changeFormDimensionUnit}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["length", "breadth", "height"] as const).map((key) => {
                  const labelMap = {
                    length: "Length",
                    breadth: "Breadth",
                    height: "Height",
                  } as const;
                  const isFeet = v.dimensionUnit === "ft";
                  return (
                    <label key={key} className="flex flex-col gap-1.5">
                      <span className={labelCls}>{labelMap[key]}</span>
                      <Input
                        type={isFeet ? "text" : "number"}
                        inputMode={isFeet ? "text" : "decimal"}
                        min={isFeet ? undefined : "0"}
                        step={isFeet ? undefined : "any"}
                        placeholder={isFeet ? `7'10"` : "optional"}
                        value={v[key]}
                        onChange={(e) => setDimension(key, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Qty | Unit cost * | Margin % */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>
                  Qty
                  {qtyAutoFilled && (
                    <span className="ml-1.5 text-[10px] font-medium italic text-accent">
                      (auto from L × B × H)
                    </span>
                  )}
                </span>
                <Input
                  type={isFeetUnit ? "text" : "number"}
                  inputMode={isFeetUnit ? "text" : "decimal"}
                  min={isFeetUnit ? undefined : "0"}
                  step={isFeetUnit ? undefined : "any"}
                  value={v.quantity}
                  onChange={(e) => setQtyManually(e.target.value)}
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
            <div className="flex flex-col px-6 py-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="boq-save-as-element"
                  checked={v.saveAsElement}
                  onCheckedChange={(checked) => set("saveAsElement", checked)}
                />
                <label
                  htmlFor="boq-save-as-element"
                  className="flex flex-col gap-1 cursor-pointer select-none"
                >
                  <span className="text-[15px] font-semibold text-text-primary">
                    Save to element library
                  </span>
                  <span className="text-[13px] font-medium text-text-muted leading-relaxed">
                    Creates a reusable element so you can add this line to other
                    BoQs.
                  </span>
                </label>
              </div>
              {/* Saving to the library reuses the Service area chosen above. */}
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
