"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { Check, Package, Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SubmitFooter } from "@/components/ui/SubmitFooter";
import { toast } from "@/components/ui/useToast";
import { elements as elementsApi, boq as boqApi } from "@/lib/api";
import type { ListElementsResponse } from "@/lib/api/elements";
import { API } from "@/lib/api/routes";
import type { ElementUnit } from "@/lib/validations";
import { UnitFilterSelect } from "@/components/ui/UnitFilterSelect";
import { useFlag } from "@/hooks/useFlag";
import type {
  AvailableRate,
  BoqSection,
  Element,
  ElementCategoryNode,
} from "@/types";
import { buildCategoryMap } from "@/lib/elementCategories";
import { BOQ_NO_SECTION_ID, formatCurrency } from "../_lib/formatters";
import { BoqSectionSelect } from "./BoqSectionSelect";
import { BoqRateContractPicker } from "./BoqRateContractPicker";

const FILTER_ALL = "__all__";

interface FlatCategory {
  id: string;
  label: string;
}

function flattenCategories(
  tree: ElementCategoryNode[],
  depth = 0
): FlatCategory[] {
  const out: FlatCategory[] = [];
  const indent = "  ".repeat(depth);
  for (const node of tree) {
    out.push({ id: node.id, label: `${indent}${node.name}` });
    if (node.children.length > 0) {
      out.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return out;
}

interface BoqElementPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  sections: BoqSection[];
  currency: string;
  /** Element IDs already in this BOQ; rows for these are disabled. */
  existingElementIds: Set<string>;
  /** Pre-selects this section on open. `null` = Unassigned. Default behaviour without it is Unassigned. */
  defaultSectionId?: string | null;
}

const PAGE_LIMIT = 20;

interface SelectedEntry {
  quantity: string;
  element: Element;
}

/**
 * Browse the element library and add one or more library elements as BOQ line
 * items in a single batch. The rate-contract tab stays single-select since
 * each rate-contract line maps to a specific vendor price.
 */
export function BoqElementPickerDialog({
  open,
  onOpenChange,
  projectId,
  boqId,
  sections,
  currency,
  existingElementIds,
  defaultSectionId,
}: BoqElementPickerDialogProps) {
  const t = useTranslations("rateContracts");
  const [tab, setTab] = useState<"library" | "rate-contract">("library");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(FILTER_ALL);
  const [unitFilter, setUnitFilter] = useState<ElementUnit | null>(null);
  const [selected, setSelected] = useState<Map<string, SelectedEntry>>(
    () => new Map()
  );
  const [selectedRate, setSelectedRate] = useState<AvailableRate | null>(null);
  const [rateQuantity, setRateQuantity] = useState("1");
  const [sectionId, setSectionId] = useState<string>(
    defaultSectionId ?? BOQ_NO_SECTION_ID
  );
  const [submitting, setSubmitting] = useState(false);
  const rateContractsEnabled = useFlag("rateContracts");

  useEffect(() => {
    if (!open) return;
    setTab("library");
    setSearch("");
    setCategoryFilter(FILTER_ALL);
    setUnitFilter(null);
    setSelected(new Map());
    setSelectedRate(null);
    setRateQuantity("1");
    setSectionId(defaultSectionId ?? BOQ_NO_SECTION_ID);
  }, [open, defaultSectionId]);

  // Switching tabs clears the active selection so the submit button reflects
  // the visible picker.
  useEffect(() => {
    setSelected(new Map());
    setSelectedRate(null);
  }, [tab]);

  const listKey = open
    ? elementsApi.listKey({
        search: search || undefined,
        categoryId: categoryFilter === FILTER_ALL ? undefined : categoryFilter,
        unit: unitFilter ?? undefined,
        isActive: true,
        page: 1,
        limit: PAGE_LIMIT,
      })
    : null;
  const { data, isLoading } = useSWR<ListElementsResponse>(listKey);

  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    open ? API.elementCategories() : null
  );
  const categoryMap = useMemo(
    () => (catData?.tree ? buildCategoryMap(catData.tree) : new Map()),
    [catData]
  );
  const categoryOptions = useMemo<FlatCategory[]>(
    () => (catData?.tree ? flattenCategories(catData.tree) : []),
    [catData]
  );

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const selectableRows = useMemo(
    () => rows.filter((r) => !existingElementIds.has(r.id)),
    [rows, existingElementIds]
  );
  const allVisibleSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selected.has(r.id));
  const someVisibleSelected = selectableRows.some((r) => selected.has(r.id));

  const toggleOne = (el: Element) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(el.id)) {
        next.delete(el.id);
      } else {
        next.set(el.id, { quantity: "1", element: el });
      }
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) {
        for (const r of selectableRows) {
          if (!next.has(r.id)) next.set(r.id, { quantity: "1", element: r });
        }
      } else {
        for (const r of selectableRows) next.delete(r.id);
      }
      return next;
    });
  };

  const setQty = (id: string, value: string) => {
    setSelected((prev) => {
      const entry = prev.get(id);
      if (!entry) return prev;
      const next = new Map(prev);
      next.set(id, { ...entry, quantity: value });
      return next;
    });
  };

  const removeOne = (id: string) => {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const clearAll = () => setSelected(new Map());

  const selectedCount = selected.size;
  const selectedEntries = useMemo(
    () => Array.from(selected.values()),
    [selected]
  );

  const handleSubmitLibrary = async () => {
    if (selectedCount === 0) return;
    const items: Array<{ elementId: string; quantity: number }> = [];
    for (const entry of selectedEntries) {
      const qty = parseFloat(entry.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a positive quantity for ${entry.element.name}.`,
          variant: "error",
        });
        return;
      }
      items.push({ elementId: entry.element.id, quantity: qty });
    }
    setSubmitting(true);
    try {
      await boqApi.addElements(projectId, {
        boqId,
        sectionId: sectionId === BOQ_NO_SECTION_ID ? null : sectionId,
        items,
      });
      await globalMutate(API.boq(projectId));
      toast({
        title:
          items.length === 1
            ? "Item added from library"
            : `${items.length} items added from library`,
        variant: "success",
      });
      onOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Could not add items",
        description,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRate = async () => {
    // The browse picker only surfaces element-bearing rates; the element id is
    // required to add an element row to the BOQ.
    if (!selectedRate?.element_id) return;
    const elementId = selectedRate.element_id;
    const qty = parseFloat(rateQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({
        title: "Quantity required",
        description: "Enter a positive number.",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      await boqApi.addElement(projectId, {
        boqId,
        sectionId: sectionId === BOQ_NO_SECTION_ID ? null : sectionId,
        elementId,
        quantity: qty,
        rateContractItemId: selectedRate.rate_contract_item_id,
      });
      await globalMutate(API.boq(projectId));
      toast({
        title: "Item added from rate contract",
        variant: "success",
      });
      onOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Could not add item",
        description,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled =
    tab === "library" ? selectedCount === 0 : !selectedRate;
  const submitLabel =
    tab === "library"
      ? selectedCount > 1
        ? `Add ${selectedCount} to BOQ`
        : "Add to BOQ"
      : "Add to BOQ";
  const onSubmit = tab === "library" ? handleSubmitLibrary : handleSubmitRate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add to BOQ</DialogTitle>
          <DialogDescription>
            Pick one or more elements from the library, or use a pre-negotiated
            rate contract.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "library" | "rate-contract")}
        >
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            {rateContractsEnabled && (
              <TabsTrigger value="rate-contract">
                {t("boqPickerTab")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="library" className="flex flex-col gap-3 mt-3">
            <SearchInput
              placeholder="Search by name, code, or description…"
              debounceMs={200}
              onDebouncedChange={setSearch}
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All categories</SelectItem>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <UnitFilterSelect value={unitFilter} onChange={setUnitFilter} />
            </div>

            <div className="rounded-lg border border-border-default bg-bg-elevated overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border-default bg-bg-secondary/40">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  disabled={selectableRows.length === 0}
                  label="Select all"
                />
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span>
                    {selectedCount > 0
                      ? `${selectedCount} selected`
                      : "None selected"}
                  </span>
                  {selectedCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="min-h-[240px] max-h-[320px] overflow-y-auto">
                {isLoading && rows.length === 0 ? (
                  <SkeletonList />
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted gap-2">
                    <Package className="h-5 w-5" />
                    <span>No elements match.</span>
                  </div>
                ) : (
                  <ul className="flex flex-col">
                    {rows.map((el) => {
                      const checked = selected.has(el.id);
                      const inBoq = existingElementIds.has(el.id);
                      const categoryName = el.category_id
                        ? categoryMap.get(el.category_id)
                        : null;
                      return (
                        <li key={el.id}>
                          <button
                            type="button"
                            onClick={() => !inBoq && toggleOne(el)}
                            disabled={inBoq}
                            title={inBoq ? "Already in this BOQ" : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border-default last:border-b-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              checked
                                ? "bg-accent/10"
                                : inBoq
                                  ? ""
                                  : "hover:bg-bg-secondary/60 cursor-pointer"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                                checked
                                  ? "border-accent bg-accent"
                                  : "border-border-light bg-bg-secondary"
                              }`}
                            >
                              <Check
                                className={`h-3 w-3 text-text-on-accent ${checked ? "opacity-100" : "opacity-0"}`}
                                strokeWidth={3}
                              />
                            </span>
                            <span className="flex-shrink-0 w-[70px] text-xs font-mono text-text-muted truncate">
                              {el.code}
                            </span>
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                              <span className="text-text-primary truncate">
                                {el.name}
                              </span>
                              <span className="flex items-center gap-2 text-xs text-text-muted">
                                {inBoq && (
                                  <span className="px-1.5 py-0.5 rounded bg-bg-secondary text-text-muted">
                                    Already in BOQ
                                  </span>
                                )}
                                {categoryName && (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <Tag className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">
                                      {categoryName}
                                    </span>
                                  </span>
                                )}
                                {el.tags && el.tags.length > 0 && (
                                  <span className="truncate">
                                    · {el.tags.slice(0, 3).join(", ")}
                                    {el.tags.length > 3
                                      ? ` +${el.tags.length - 3}`
                                      : ""}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="flex-shrink-0 w-[50px] text-xs text-text-muted text-right">
                              {el.unit}
                            </span>
                            <span className="flex-shrink-0 w-[100px] text-xs text-text-primary text-right tabular-nums">
                              {formatCurrency(
                                el.unit_cost,
                                el.currency || currency
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {selectedCount > 0 && (
              <div className="rounded-lg border border-border-default bg-bg-elevated">
                <div className="px-3 py-2 border-b border-border-default text-xs font-medium text-text-secondary">
                  Selected ({selectedCount})
                </div>
                <ul className="flex flex-col max-h-[160px] overflow-y-auto">
                  {selectedEntries.map((entry) => (
                    <li
                      key={entry.element.id}
                      className="flex items-center gap-3 px-3 py-2 border-b border-border-default last:border-b-0 text-sm"
                    >
                      <span className="flex-shrink-0 w-[70px] text-xs font-mono text-text-muted truncate">
                        {entry.element.code}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-text-primary">
                        {entry.element.name}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span>Qty</span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={entry.quantity}
                          onChange={(e) =>
                            setQty(entry.element.id, e.target.value)
                          }
                          className="w-20 h-9 text-xs"
                        />
                        <span className="w-[36px] text-text-muted text-right">
                          {entry.element.unit}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeOne(entry.element.id)}
                        className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                        aria-label={`Remove ${entry.element.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {rateContractsEnabled && (
            <TabsContent
              value="rate-contract"
              className="flex flex-col gap-3 mt-3"
            >
              <BoqRateContractPicker
                selectedRateContractItemId={
                  selectedRate?.rate_contract_item_id ?? null
                }
                onSelect={setSelectedRate}
                enabled={tab === "rate-contract"}
                existingElementIds={existingElementIds}
              />
              {selectedRate && (
                <div className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2.5 text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-primary">
                      {selectedRate.element_name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <Tag className="h-3 w-3" />
                      {selectedRate.vendor_name}
                    </span>
                  </div>
                  <div className="flex gap-3 text-text-muted flex-wrap">
                    <span>
                      Rate{" "}
                      {formatCurrency(selectedRate.rate, selectedRate.currency)}
                    </span>
                    <span>Contract {selectedRate.contract_number}</span>
                    <span>Expires {selectedRate.end_date}</span>
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <div
          className={`grid gap-3 mt-2 ${
            tab === "rate-contract" ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <BoqSectionSelect
            value={sectionId}
            onChange={setSectionId}
            sections={sections}
            projectId={projectId}
            boqId={boqId}
            nextSortOrder={sections.length}
          />
          {tab === "rate-contract" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Quantity
              </span>
              <Input
                type="number"
                min="0"
                step="any"
                value={rateQuantity}
                onChange={(e) => setRateQuantity(e.target.value)}
              />
            </label>
          )}
        </div>

        <SubmitFooter
          submitting={submitting}
          submitLabel={submitLabel}
          submittingLabel="Adding..."
          disabled={submitDisabled}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
