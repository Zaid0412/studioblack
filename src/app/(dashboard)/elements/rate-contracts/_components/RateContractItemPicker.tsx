"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { UnitFilterSelect } from "@/components/ui/UnitFilterSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ServiceAreaSelect } from "@/components/elements/ServiceAreaSelect";
import { serviceAreaCreate } from "@/components/elements/ServiceAreaDialog";
import { cn } from "@/lib/utils";
import { toIsoDate, fromIsoDate } from "@/lib/formatDate";
import { elements as elementsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { buildCategoryMap } from "@/lib/elementCategories";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { ListElementsResponse } from "@/lib/api/elements";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import type { Element, ElementCategoryNode } from "@/types";

const ALLOWED_UNIT_SET = new Set<string>(ALLOWED_UNITS);

export interface RateContractItemDraftSubmit {
  categoryId: string;
  elementId?: string;
  unit: ElementUnit;
  rate: number;
  description?: string | null;
  minQty?: number | null;
  maxQty?: number | null;
  leadTimeDays?: number | null;
  validUntil?: string | null;
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
  description: string;
  minQty: string;
  maxQty: string;
  leadTimeDays: string;
  validUntil: string;
  taxPct: string;
  notes: string;
  /** Whether the optional-detail section is expanded for this draft. */
  expanded: boolean;
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

  // Cascade the pickable element rows in on open / search change.
  const listRef = useStaggerReveal<HTMLDivElement>(
    elements.map((el) => el.id).join(",")
  );

  /** Add a service-area draft (`element` null) or an element override. */
  const addDraft = (
    categoryId: string | null,
    element: Element | null = null
  ) => {
    if (!categoryId) return;
    const key = element ? `el:${element.id}` : `area:${categoryId}`;
    if (draftKeys.has(key) || existingKeys.has(key)) return;
    const unit =
      element && ALLOWED_UNIT_SET.has(element.unit)
        ? (element.unit as ElementUnit)
        : null;
    setDrafts((s) => [
      ...s,
      {
        key,
        categoryId,
        categoryLabel: categoryMap.get(categoryId) ?? "",
        element,
        rate: "",
        unit,
        description: "",
        minQty: "",
        maxQty: "",
        leadTimeDays: "",
        validUntil: "",
        taxPct: "",
        notes: "",
        expanded: false,
      },
    ]);
  };

  /** Optional numeric field → number | null. */
  const numOrNull = (s: string) => (s.trim() ? Number(s) : null);

  /** Accent the detail toggle when it's open or any optional field is filled. */
  const hasDetail = (d: DraftRow) =>
    d.expanded ||
    !!(
      d.description ||
      d.minQty ||
      d.maxQty ||
      d.leadTimeDays ||
      d.validUntil ||
      d.taxPct ||
      d.notes
    );

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
            description: d.description.trim() || null,
            minQty: numOrNull(d.minQty),
            maxQty: numOrNull(d.maxQty),
            leadTimeDays: numOrNull(d.leadTimeDays),
            validUntil: d.validUntil || null,
            taxPct: numOrNull(d.taxPct),
            notes: d.notes.trim() || null,
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
          <DialogDescription>
            {t("itemPickerCurrencyHint", { currency: contractCurrency })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Add a whole service area */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("itemPickerAddArea")}
            </label>
            {/* Used as an action, not a field: it holds no value, so every open
                starts back at the Category level and picking a leaf adds a draft
                row below rather than filling the trigger in. Existing off-level
                items on old contracts are untouched — this only gates what can
                be added from here. */}
            <ServiceAreaSelect
              value={null}
              onChange={(id) => addDraft(id)}
              tree={catData?.tree ?? []}
              placeholder={t("itemPickerAreaPlaceholder")}
              // Inline create builds the whole Category › Sub-category › Service
              // Area chain — the generic category form deliberately can't reach
              // level 3, i.e. can't create what this picker accepts.
              renderCreate={serviceAreaCreate(catData?.tree ?? [])}
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
            <div
              ref={listRef}
              className="border border-border-default rounded-lg max-h-[220px] overflow-y-auto shrink-0"
            >
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
                      data-anim-item
                      type="button"
                      onClick={() =>
                        !inContract && !inDraft && addDraft(el.category_id, el)
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
              <div className="flex flex-col gap-2">
                {drafts.map((d) => (
                  <div
                    key={d.key}
                    className="flex flex-col gap-2 rounded-md border border-border-default p-2"
                  >
                    <div className="flex items-center gap-2">
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
                        onClick={() =>
                          updateDraft(d.key, { expanded: !d.expanded })
                        }
                        aria-label={t("itemOptionalDetail")}
                        title={t("itemOptionalDetail")}
                        className={hasDetail(d) ? "text-accent" : ""}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDraft(d.key)}
                        aria-label={t("removeItem")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Optional procurement detail — collapsed by default to keep
                        the list compact; smooth height animation on toggle. */}
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                        d.expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      )}
                      aria-hidden={!d.expanded}
                    >
                      <div className="overflow-hidden">
                        <div className="flex flex-col gap-2 border-t border-border-default pt-2">
                          <Input
                            label={t("itemDescription")}
                            value={d.description}
                            onChange={(e) =>
                              updateDraft(d.key, {
                                description: e.target.value,
                              })
                            }
                            maxLength={2000}
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Input
                              label={t("itemMinQty")}
                              value={d.minQty}
                              onChange={(e) =>
                                updateDraft(d.key, { minQty: e.target.value })
                              }
                              type="number"
                              min="0"
                            />
                            <Input
                              label={t("itemMaxQty")}
                              value={d.maxQty}
                              onChange={(e) =>
                                updateDraft(d.key, { maxQty: e.target.value })
                              }
                              type="number"
                              min="0"
                            />
                            <Input
                              label={t("itemLeadTimeDays")}
                              value={d.leadTimeDays}
                              onChange={(e) =>
                                updateDraft(d.key, {
                                  leadTimeDays: e.target.value,
                                })
                              }
                              type="number"
                              min="0"
                            />
                            <DatePicker
                              label={t("itemValidUntil")}
                              value={fromIsoDate(d.validUntil)}
                              onChange={(dt) =>
                                updateDraft(d.key, {
                                  validUntil: dt ? toIsoDate(dt) : "",
                                })
                              }
                            />
                            <Input
                              label={t("itemTaxPct")}
                              value={d.taxPct}
                              onChange={(e) =>
                                updateDraft(d.key, { taxPct: e.target.value })
                              }
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </div>
                          <Input
                            label={t("itemNotes")}
                            value={d.notes}
                            onChange={(e) =>
                              updateDraft(d.key, { notes: e.target.value })
                            }
                            placeholder={t("itemNotesPlaceholder")}
                            maxLength={2000}
                          />
                        </div>
                      </div>
                    </div>
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
