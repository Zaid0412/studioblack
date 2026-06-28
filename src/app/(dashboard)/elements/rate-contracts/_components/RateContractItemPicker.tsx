"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { UnitFilterSelect } from "@/components/ui/UnitFilterSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { CategorySelect } from "@/app/(dashboard)/elements/_components/CategorySelect";
import { elements as elementsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { buildCategoryMap } from "@/lib/elementCategories";
import type { ListElementsResponse } from "@/lib/api/elements";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import type { Element, ElementCategoryNode } from "@/types";

const ALLOWED_UNIT_SET = new Set<string>(ALLOWED_UNITS);

export interface RateContractItemDraftSubmit {
  categoryId: string;
  elementId?: string;
  unit: ElementUnit;
  rate: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractCurrency: string;
  /**
   * Keys already in the contract — disabled in the picker. `el:<elementId>` for
   * element overrides, `area:<categoryId>` for service-area rates.
   */
  existingKeys: Set<string>;
  onSubmit: (rows: RateContractItemDraftSubmit[]) => Promise<void>;
}

interface DraftRow {
  /** `el:<id>` or `area:<id>` — unique per draft. */
  key: string;
  categoryId: string;
  categoryLabel: string;
  /** Element override; null = the rate covers the whole service area. */
  element: Element | null;
  rate: string;
  unit: ElementUnit | null;
}

/**
 * Adds rate-contract items two ways: a whole **service area** (taxonomy leaf),
 * or a specific **element** (whose service area is derived). Each draft takes a
 * unit + rate; submitted as a bulk insert/upsert.
 */
export function RateContractItemPicker({
  open,
  onOpenChange,
  contractCurrency,
  existingKeys,
  onSubmit,
}: Props) {
  const t = useTranslations("rateContracts");
  const tCommon = useTranslations("common");

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDrafts([]);
    }
  }, [open]);

  // Category map (id → name) labels both element-derived and service-area drafts.
  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    open ? API.elementCategories() : null
  );
  const categoryMap = useMemo(
    () =>
      catData?.tree
        ? buildCategoryMap(catData.tree)
        : new Map<string, string>(),
    [catData]
  );

  const listKey = open
    ? elementsApi.listKey({
        search: search || undefined,
        isActive: true,
        limit: 100,
      })
    : null;
  const { data, isLoading } = useSWR<ListElementsResponse>(listKey);
  const allElements = data?.rows ?? [];
  // Currency match is enforced server-side; filter here so the user can't pick
  // a doomed element. Elements without a service area can't be priced.
  const elements = allElements.filter(
    (el) => el.currency === contractCurrency && el.category_id
  );
  const filteredOutByCurrency = allElements.length > 0 && elements.length === 0;

  const draftKeys = useMemo(() => new Set(drafts.map((d) => d.key)), [drafts]);

  const addElementDraft = (element: Element) => {
    if (!element.category_id) return;
    const key = `el:${element.id}`;
    if (draftKeys.has(key) || existingKeys.has(key)) return;
    const unit = ALLOWED_UNIT_SET.has(element.unit)
      ? (element.unit as ElementUnit)
      : null;
    setDrafts((s) => [
      ...s,
      {
        key,
        categoryId: element.category_id as string,
        categoryLabel: categoryMap.get(element.category_id as string) ?? "",
        element,
        rate: "",
        unit,
      },
    ]);
  };

  const addAreaDraft = (categoryId: string | null) => {
    if (!categoryId) return;
    const key = `area:${categoryId}`;
    if (draftKeys.has(key) || existingKeys.has(key)) return;
    setDrafts((s) => [
      ...s,
      {
        key,
        categoryId,
        categoryLabel: categoryMap.get(categoryId) ?? "",
        element: null,
        rate: "",
        unit: null,
      },
    ]);
  };

  const updateDraft = (key: string, patch: Partial<DraftRow>) => {
    setDrafts((s) => s.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeDraft = (key: string) => {
    setDrafts((s) => s.filter((d) => d.key !== key));
  };

  const canSubmit =
    drafts.length > 0 &&
    drafts.every(
      (d) => d.unit !== null && d.rate.trim() && Number(d.rate) > 0
    ) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(
        drafts
          .filter((d): d is DraftRow & { unit: ElementUnit } => d.unit !== null)
          .map((d) => ({
            categoryId: d.categoryId,
            ...(d.element ? { elementId: d.element.id } : {}),
            unit: d.unit,
            rate: Number(d.rate),
          }))
      );
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("itemPickerTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-text-muted">
            {t("itemPickerCurrencyHint", { currency: contractCurrency })}
          </p>

          {/* Add a whole service area */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("itemPickerAddArea")}
            </label>
            <CategorySelect
              value={null}
              onChange={addAreaDraft}
              tree={catData?.tree ?? []}
              minDepth={1}
            />
          </div>

          {/* Or add a specific element (its service area is derived) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("itemPickerAddElement")}
            </label>
            <SearchInput
              placeholder={t("itemPickerSearchPlaceholder")}
              value={search}
              debounceMs={300}
              onDebouncedChange={setSearch}
            />
            <div className="border border-border-default rounded-lg max-h-[220px] overflow-y-auto shrink-0">
              {isLoading ? (
                <div className="flex flex-col gap-1 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded" />
                  ))}
                </div>
              ) : filteredOutByCurrency ? (
                <p className="p-4 text-sm text-text-muted italic">
                  {t("itemPickerNoMatchingCurrency", {
                    currency: contractCurrency,
                  })}
                </p>
              ) : elements.length === 0 ? (
                <p className="p-4 text-sm text-text-muted italic">
                  {t("itemPickerEmpty")}
                </p>
              ) : (
                elements.map((el) => {
                  const key = `el:${el.id}`;
                  const inContract = existingKeys.has(key);
                  const inDraft = draftKeys.has(key);
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() =>
                        !inContract && !inDraft && addElementDraft(el)
                      }
                      disabled={inContract || inDraft}
                      className="w-full text-left px-3 py-2 border-b border-border-default last:border-b-0 hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      <span className="font-mono text-xs text-text-muted w-32 truncate">
                        {el.code}
                      </span>
                      <span className="flex-1 text-sm text-text-primary truncate">
                        {el.name}
                      </span>
                      <span className="text-xs text-text-muted">
                        {inContract
                          ? t("itemPickerInContract")
                          : inDraft
                            ? t("itemPickerInDraft")
                            : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {drafts.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("itemPickerDraftHeader", { count: drafts.length })}
              </h4>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {drafts.map((d) => (
                  <div
                    key={d.key}
                    className="flex items-center gap-2 rounded-md border border-border-default p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">
                        {d.categoryLabel || d.categoryId}
                      </div>
                      <div className="font-mono text-xs text-text-muted truncate">
                        {d.element
                          ? `${d.element.code} · ${d.element.name}`
                          : t("itemWholeArea")}
                      </div>
                    </div>
                    <div className="w-24 shrink-0">
                      <UnitFilterSelect
                        value={d.unit}
                        onChange={(unit) => updateDraft(d.key, { unit })}
                        placeholder={t("itemPickerUnitPlaceholder")}
                        allLabel={t("itemPickerUnitClear")}
                      />
                    </div>
                    <Input
                      value={d.rate}
                      onChange={(e) =>
                        updateDraft(d.key, { rate: e.target.value })
                      }
                      placeholder={t("itemPickerRatePlaceholder", {
                        currency: contractCurrency,
                      })}
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="w-32 h-9 px-3 py-2"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDraft(d.key)}
                      aria-label={t("removeItem")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={submitting}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? tCommon("loading") : t("itemPickerSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
