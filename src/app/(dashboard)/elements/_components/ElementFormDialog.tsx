"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import {
  Save,
  Plus,
  X,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/TagInput";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { Badge } from "@/components/ui/badge";
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type ElementUnit } from "@/lib/validations";
import { API } from "@/lib/api/routes";
import type { Element, ElementCategoryNode, ElementWithDetails } from "@/types";
import { CategorySelect } from "./CategorySelect";
import { formatMoney } from "../_lib/formatters";

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
  imageUrl: string | null;
  drawingFileUrl: string | null;
  drawingFileName: string | null;
  specFileUrl: string | null;
  specFileName: string | null;
}

type CostKey =
  | "unitCost"
  | "materialCost"
  | "labourCost"
  | "overheadPct"
  | "marginPct";

const COST_FIELDS: ReadonlyArray<{
  key: CostKey;
  labelKey: string;
  required?: boolean;
  max?: string;
}> = [
  { key: "unitCost", labelKey: "fieldUnitCost", required: true },
  { key: "materialCost", labelKey: "fieldMaterialCost" },
  { key: "labourCost", labelKey: "fieldLabourCost" },
  { key: "overheadPct", labelKey: "fieldOverheadPct", max: "100" },
  { key: "marginPct", labelKey: "fieldMarginPct", max: "100" },
];

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
  imageUrl: null,
  drawingFileUrl: null,
  drawingFileName: null,
  specFileUrl: null,
  specFileName: null,
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
    imageUrl: el.image_url,
    drawingFileUrl: el.drawing_file_url,
    drawingFileName: el.drawing_file_name,
    specFileUrl: el.spec_file_url,
    specFileName: el.spec_file_name,
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

/** Create/edit dialog for an element — handles attributes, costs, tags, and version history. */
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
  const categoryTree = catData?.tree ?? [];

  const [showHistory, setShowHistory] = useState(false);
  // v1 elements have no history — skip the fetch and the toggle entirely.
  const hasHistory = (editing?.version_number ?? 0) > 1;
  const historyKey =
    editing && showHistory && hasHistory
      ? API.elementVersions(editing.id)
      : null;
  // Suppress the global SWR error toast for this fetch — the UI already
  // renders an empty/loading state inline.
  const { data: historyData } = useSWR<{ versions: Element[] }>(historyKey, {
    onError: () => {},
  });
  const versions = historyData?.versions ?? [];

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync: hydrate form from the editing element (or reset) when dialog opens
    setValues(editing ? elementToFormValues(editing) : EMPTY_FORM);

    setShowHistory(false);
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
      imageUrl: values.imageUrl,
      drawingFileUrl: values.drawingFileUrl,
      drawingFileName: values.drawingFileName,
      specFileUrl: values.specFileUrl,
      specFileName: values.specFileName,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{editing ? tCommon("edit") : t("newElement")}</SheetTitle>
        </SheetHeader>

        <form
          id="element-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetBody className="flex flex-col gap-4">
            {/* Image + identity */}
            <div className="flex flex-col md:flex-row gap-4">
              <FileUploadSlot
                variant="image"
                label={t("fieldImage")}
                url={values.imageUrl}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onUploaded={({ url }) => setField("imageUrl", url)}
                onCleared={() => setField("imageUrl", null)}
              />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 self-start">
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
              <CategorySelect
                label={t("fieldCategory")}
                value={values.categoryId}
                onChange={(id) => setField("categoryId", id)}
                tree={categoryTree}
              />

              <UnitSelect
                label={t("fieldUnit")}
                value={values.unit}
                onChange={(u) => setField("unit", u)}
                required
              />

              <CurrencySelect
                label={t("fieldCurrency")}
                value={values.currency}
                onChange={(code) => setField("currency", code)}
                required
              />
            </div>

            {/* Costs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {COST_FIELDS.map((f) => (
                <Input
                  key={f.key}
                  label={t(f.labelKey)}
                  type="number"
                  step="0.01"
                  min="0"
                  max={f.max}
                  value={values[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  required={f.required}
                />
              ))}
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

            {/* Production drawing + spec file uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FileUploadSlot
                variant="file"
                label={t("fieldDrawingFile")}
                url={values.drawingFileUrl}
                fileName={values.drawingFileName}
                accept=".pdf,.dwg,.dxf,.skp,.png,.jpg,.jpeg,.webp"
                onUploaded={({ url, fileName }) => {
                  setField("drawingFileUrl", url);
                  setField("drawingFileName", fileName);
                }}
                onCleared={() => {
                  setField("drawingFileUrl", null);
                  setField("drawingFileName", null);
                }}
              />
              <FileUploadSlot
                variant="file"
                label={t("fieldSpecFile")}
                url={values.specFileUrl}
                fileName={values.specFileName}
                accept=".pdf,.doc,.docx,.txt"
                onUploaded={({ url, fileName }) => {
                  setField("specFileUrl", url);
                  setField("specFileName", fileName);
                }}
                onCleared={() => {
                  setField("specFileUrl", null);
                  setField("specFileName", null);
                }}
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

            {editing && hasHistory && (
              <div className="flex flex-col gap-2 border-t border-border-default pt-3">
                <button
                  type="button"
                  onClick={() => setShowHistory((s) => !s)}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors self-start"
                >
                  {showHistory ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <History className="w-4 h-4" />
                  {t("versionHistory")}
                  {editing.version_number > 1 && (
                    <Badge
                      variant="info"
                      className="ml-1 font-mono text-[10px] px-2 py-0.5"
                    >
                      {t("versionN", { n: editing.version_number })}
                    </Badge>
                  )}
                </button>
                {showHistory && (
                  <div className="flex flex-col gap-1 pl-5 text-xs">
                    {versions.length === 0 ? (
                      <span className="text-text-muted">
                        {tCommon("loading")}
                      </span>
                    ) : versions.length === 1 ? (
                      <span className="text-text-muted">
                        {t("noPreviousVersions")}
                      </span>
                    ) : (
                      versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-3 py-1 border-b border-border-default/50 last:border-b-0"
                        >
                          <span className="font-mono text-text-secondary w-10">
                            {t("versionN", { n: v.version_number })}
                          </span>
                          <span className="text-text-muted whitespace-nowrap">
                            {new Date(v.created_at).toLocaleDateString()}
                          </span>
                          <span className="font-mono text-text-primary">
                            {formatMoney(v.unit_cost, v.currency)}
                          </span>
                          <span className="text-text-muted truncate">
                            {v.name}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </SheetBody>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="secondary">
                {tCommon("cancel")}
              </Button>
            </SheetClose>
            <Button type="submit" disabled={submitting}>
              <Save className="w-4 h-4" />
              {submitting ? tCommon("loading") : tCommon("save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
