"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/TagInput";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import { API } from "@/lib/api/routes";
import type { ElementCategoryNode, ElementWithDetails } from "@/types";
import { flattenCategories } from "../_lib/categoryUtils";

const NONE = "__none__";

interface Attribute {
  attribute_key: string;
  attribute_value: string;
  unit?: string;
}

export interface ElementFormValues {
  code: string;
  name: string;
  description: string;
  categoryId: string | null;
  unit: ElementUnit;
  unitCost: string;
  currency: string;
  materialCost: string;
  labourCost: string;
  overheadPct: string;
  marginPct: string;
  specReference: string;
  drawingRef: string;
  tags: string[];
  attributes: Attribute[];
}

const EMPTY_FORM: ElementFormValues = {
  code: "",
  name: "",
  description: "",
  categoryId: null,
  unit: "m2",
  unitCost: "",
  currency: "USD",
  materialCost: "",
  labourCost: "",
  overheadPct: "",
  marginPct: "",
  specReference: "",
  drawingRef: "",
  tags: [],
  attributes: [],
};

function elementToFormValues(el: ElementWithDetails): ElementFormValues {
  return {
    code: el.code,
    name: el.name,
    description: el.description ?? "",
    categoryId: el.category_id,
    unit: el.unit as ElementUnit,
    unitCost: el.unit_cost,
    currency: el.currency,
    materialCost: el.material_cost ?? "",
    labourCost: el.labour_cost ?? "",
    overheadPct: el.overhead_pct ?? "",
    marginPct: el.margin_pct ?? "",
    specReference: el.spec_reference ?? "",
    drawingRef: el.drawing_ref ?? "",
    tags: el.tags ?? [],
    attributes: el.attributes.map((a) => ({
      attribute_key: a.attribute_key,
      attribute_value: a.attribute_value,
      unit: a.unit ?? undefined,
    })),
  };
}

interface Props {
  open: boolean;
  editing: ElementWithDetails | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: Omit<
      ElementFormValues,
      "unitCost" | "materialCost" | "labourCost" | "overheadPct" | "marginPct"
    > & {
      unitCost: number;
      materialCost?: number;
      labourCost?: number;
      overheadPct?: number;
      marginPct?: number;
    }
  ) => Promise<void>;
}

export function ElementFormDialog({
  open,
  editing,
  submitting,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState<ElementFormValues>(EMPTY_FORM);

  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    API.elementCategories()
  );
  const categoryOptions = catData?.tree ? flattenCategories(catData.tree) : [];

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync: hydrate form from the editing element (or reset) when dialog opens
    setValues(editing ? elementToFormValues(editing) : EMPTY_FORM);
  }, [editing, open]);

  const setField = <K extends keyof ElementFormValues>(
    key: K,
    value: ElementFormValues[K]
  ) => setValues((v) => ({ ...v, [key]: value }));

  const addAttribute = () =>
    setValues((v) => ({
      ...v,
      attributes: [
        ...v.attributes,
        { attribute_key: "", attribute_value: "", unit: undefined },
      ],
    }));

  const removeAttribute = (i: number) =>
    setValues((v) => ({
      ...v,
      attributes: v.attributes.filter((_, idx) => idx !== i),
    }));

  const setAttribute = (i: number, patch: Partial<Attribute>) =>
    setValues((v) => ({
      ...v,
      attributes: v.attributes.map((a, idx) =>
        idx === i ? { ...a, ...patch } : a
      ),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toNumber = (s: string) =>
      s === "" ? undefined : Number.parseFloat(s);
    await onSubmit({
      code: values.code,
      name: values.name,
      description: values.description,
      categoryId: values.categoryId,
      unit: values.unit,
      currency: values.currency,
      specReference: values.specReference,
      drawingRef: values.drawingRef,
      attributes: values.attributes.filter(
        (a) => a.attribute_key && a.attribute_value
      ),
      tags: values.tags,
      unitCost: Number.parseFloat(values.unitCost || "0"),
      materialCost: toNumber(values.materialCost),
      labourCost: toNumber(values.labourCost),
      overheadPct: toNumber(values.overheadPct),
      marginPct: toNumber(values.marginPct),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? tCommon("edit") : t("newElement")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Basic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("fieldCode")}
              value={values.code}
              onChange={(e) => setField("code", e.target.value)}
              required
              maxLength={50}
            />
            <Input
              label={t("fieldName")}
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              maxLength={255}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("fieldDescription")}
            </label>
            <textarea
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary min-h-[70px] focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                {t("fieldCategory")}
              </label>
              <Select
                value={values.categoryId ?? NONE}
                onValueChange={(v) =>
                  setField("categoryId", v === NONE ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                {t("fieldUnit")}
                <span className="text-error ml-0.5">*</span>
              </label>
              <Select
                value={values.unit}
                onValueChange={(v) => setField("unit", v as ElementUnit)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              label={t("fieldCurrency")}
              value={values.currency}
              onChange={(e) =>
                setField("currency", e.target.value.toUpperCase())
              }
              maxLength={3}
              required
            />
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Input
              label={t("fieldUnitCost")}
              type="number"
              step="0.01"
              min="0"
              value={values.unitCost}
              onChange={(e) => setField("unitCost", e.target.value)}
              required
            />
            <Input
              label={t("fieldMaterialCost")}
              type="number"
              step="0.01"
              min="0"
              value={values.materialCost}
              onChange={(e) => setField("materialCost", e.target.value)}
            />
            <Input
              label={t("fieldLabourCost")}
              type="number"
              step="0.01"
              min="0"
              value={values.labourCost}
              onChange={(e) => setField("labourCost", e.target.value)}
            />
            <Input
              label={t("fieldOverheadPct")}
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={values.overheadPct}
              onChange={(e) => setField("overheadPct", e.target.value)}
            />
            <Input
              label={t("fieldMarginPct")}
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={values.marginPct}
              onChange={(e) => setField("marginPct", e.target.value)}
            />
          </div>

          {/* References + tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("fieldSpecReference")}
              value={values.specReference}
              onChange={(e) => setField("specReference", e.target.value)}
              maxLength={255}
            />
            <Input
              label={t("fieldDrawingRef")}
              value={values.drawingRef}
              onChange={(e) => setField("drawingRef", e.target.value)}
              maxLength={255}
            />
          </div>
          <TagInput
            label={t("fieldTags")}
            placeholder={t("tagsPlaceholder")}
            value={values.tags}
            onChange={(tags) => setField("tags", tags)}
          />

          {/* Attributes */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-text-secondary">
                {t("fieldAttributes")}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addAttribute}
              >
                <Plus className="w-4 h-4" />
                {t("addAttribute")}
              </Button>
            </div>
            {values.attributes.map((attr, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center"
              >
                <Input
                  placeholder={t("attributeKey")}
                  value={attr.attribute_key}
                  onChange={(e) =>
                    setAttribute(i, { attribute_key: e.target.value })
                  }
                />
                <Input
                  placeholder={t("attributeValue")}
                  value={attr.attribute_value}
                  onChange={(e) =>
                    setAttribute(i, { attribute_value: e.target.value })
                  }
                />
                <Input
                  placeholder={t("attributeUnit")}
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

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              <Save className="w-4 h-4" />
              {submitting ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
