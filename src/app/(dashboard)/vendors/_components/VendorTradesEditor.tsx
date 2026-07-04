"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  OptionWithIcon,
} from "@/components/ui/select";
import { VENDOR_PROFICIENCY_ICONS } from "@/lib/vendorLabels";
import { CategorySelect } from "@/app/(dashboard)/elements/_components/CategorySelect";
import { API } from "@/lib/api/routes";
import { VENDOR_PROFICIENCIES } from "@/lib/validations";
import type { ElementCategoryNode, VendorProficiency } from "@/types";

export interface TradeDraft {
  categoryId: string | null;
  proficiencyLevel: VendorProficiency;
  notes: string;
}

export const EMPTY_TRADE: TradeDraft = {
  categoryId: null,
  proficiencyLevel: "standard",
  notes: "",
};

interface Props {
  trades: TradeDraft[];
  onChange: (next: TradeDraft[]) => void;
}

/**
 * Vendor service-area picker. Labelled "Service areas" in the UI, but the
 * underlying entity is the `vendor_trade` table (vendor ↔ element_category
 * mapping with proficiency) — the internal `trade` naming is kept to avoid a
 * rename migration. `minDepth={1}` limits picks to sub-categories + leaf
 * service areas (top-level categories excluded).
 */
export function VendorTradesEditor({ trades, onChange }: Props) {
  const t = useTranslations("vendors");
  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    API.elementCategories()
  );
  const tree = useMemo(() => catData?.tree ?? [], [catData]);

  const usedIds = useMemo(
    () =>
      new Set(trades.map((tr) => tr.categoryId).filter(Boolean) as string[]),
    [trades]
  );

  const update = (i: number, patch: Partial<TradeDraft>) => {
    onChange(trades.map((tr, idx) => (idx === i ? { ...tr, ...patch } : tr)));
  };

  const remove = (i: number) => onChange(trades.filter((_, idx) => idx !== i));

  const add = () => onChange([...trades, { ...EMPTY_TRADE }]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-text-secondary">
          {t("tradesLabel")}
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
          {t("addTrade")}
        </Button>
      </div>

      {trades.length === 0 ? (
        <p className="text-xs text-text-muted italic">{t("noTrades")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {trades.map((tr, i) => {
            const duplicate =
              !!tr.categoryId &&
              trades.findIndex(
                (other, idx) => idx !== i && other.categoryId === tr.categoryId
              ) !== -1;
            return (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2 items-end"
              >
                <CategorySelect
                  value={tr.categoryId}
                  onChange={(id) => update(i, { categoryId: id })}
                  tree={tree}
                  minDepth={1}
                />
                <Select
                  value={tr.proficiencyLevel}
                  onValueChange={(v) =>
                    update(i, { proficiencyLevel: v as VendorProficiency })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_PROFICIENCIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <OptionWithIcon icon={VENDOR_PROFICIENCY_ICONS[p]}>
                          {t(`proficiency_${p}`)}
                        </OptionWithIcon>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(i)}
                  aria-label={t("removeTrade")}
                  className="text-error hover:text-error"
                >
                  <X className="w-4 h-4" />
                </Button>
                {duplicate && (
                  <p className="md:col-span-3 text-xs text-error">
                    {t("duplicateTrade")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {usedIds.size > 0 && trades.some((tr) => !tr.categoryId) && (
        <p className="text-xs text-text-muted italic">
          {t("pickCategoryHint")}
        </p>
      )}
    </div>
  );
}
