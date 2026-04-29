"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { Package, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
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
import { features } from "@/config/features";
import type { AvailableRate, BoqSection, ElementCategoryNode } from "@/types";
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
}

const PAGE_LIMIT = 20;

/**
 * Browse the element library and add a library element as a BOQ line item.
 * Description / unit / costs / margin are copied from the element server-side.
 */
export function BoqElementPickerDialog({
  open,
  onOpenChange,
  projectId,
  boqId,
  sections,
  currency,
}: BoqElementPickerDialogProps) {
  const t = useTranslations("rateContracts");
  const [tab, setTab] = useState<"library" | "rate-contract">("library");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(FILTER_ALL);
  const [unitFilter, setUnitFilter] = useState<ElementUnit | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<AvailableRate | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [sectionId, setSectionId] = useState<string>(BOQ_NO_SECTION_ID);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("library");
    setSearch("");
    setCategoryFilter(FILTER_ALL);
    setUnitFilter(null);
    setSelectedId(null);
    setSelectedRate(null);
    setQuantity("1");
    setSectionId(BOQ_NO_SECTION_ID);
  }, [open]);

  // Switching tabs clears the active selection so the submit button reflects
  // the visible picker.
  useEffect(() => {
    setSelectedId(null);
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

  const rows = data?.rows ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const selectedCategoryName =
    selected?.category_id && categoryMap.get(selected.category_id);

  const elementId =
    tab === "library" ? selectedId : (selectedRate?.element_id ?? null);
  const rateContractItemId =
    tab === "rate-contract" ? selectedRate?.rate_contract_item_id : undefined;

  const handleSubmit = async () => {
    if (!elementId) return;
    const qty = parseFloat(quantity);
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
        rateContractItemId,
      });
      await globalMutate(API.boq(projectId));
      toast({
        title:
          tab === "rate-contract"
            ? "Item added from rate contract"
            : "Item added from library",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add to BOQ</DialogTitle>
          <DialogDescription>
            Pick an element from the library or use a pre-negotiated rate
            contract.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "library" | "rate-contract")}
        >
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            {features.rateContracts && (
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

            <div className="min-h-[280px] max-h-[360px] overflow-y-auto rounded-lg border border-border-default bg-bg-elevated">
              {isLoading && rows.length === 0 ? (
                <div className="flex flex-col gap-1 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted gap-2">
                  <Package className="h-5 w-5" />
                  <span>No elements match.</span>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {rows.map((el) => {
                    const active = el.id === selectedId;
                    const categoryName = el.category_id
                      ? categoryMap.get(el.category_id)
                      : null;
                    return (
                      <li key={el.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(el.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border-default last:border-b-0 transition-colors cursor-pointer ${
                            active ? "bg-accent/10" : "hover:bg-bg-secondary/60"
                          }`}
                        >
                          <span className="flex-shrink-0 w-[70px] text-xs font-mono text-text-muted truncate">
                            {el.code}
                          </span>
                          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-text-primary truncate">
                              {el.name}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-text-muted">
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

            {selected && (
              <div className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2.5 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-text-primary">
                    {selected.name}
                  </span>
                  {selectedCategoryName && (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <Tag className="h-3 w-3" />
                      {selectedCategoryName}
                    </span>
                  )}
                </div>
                {selected.description && (
                  <p className="text-text-secondary">{selected.description}</p>
                )}
                <div className="flex gap-3 text-text-muted flex-wrap">
                  <span>
                    Unit cost{" "}
                    {formatCurrency(
                      selected.unit_cost,
                      selected.currency || currency
                    )}
                  </span>
                  {selected.margin_pct && (
                    <span>Margin {selected.margin_pct}%</span>
                  )}
                  {selected.spec_reference && (
                    <span>Spec {selected.spec_reference}</span>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {features.rateContracts && (
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

        <div className="grid grid-cols-2 gap-3 mt-2">
          <BoqSectionSelect
            value={sectionId}
            onChange={setSectionId}
            sections={sections}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Quantity
            </span>
            <Input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>

        <SubmitFooter
          submitting={submitting}
          submitLabel="Add to BOQ"
          submittingLabel="Adding..."
          disabled={!elementId}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
