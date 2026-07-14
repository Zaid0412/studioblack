"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import { ServiceAreaSelect } from "@/components/elements/ServiceAreaSelect";
import { serviceAreaCreate } from "@/components/elements/ServiceAreaDialog";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { VENDOR_PROFICIENCIES } from "@/lib/validations";
import type { VendorProficiency } from "@/types";

export interface TradeDraft {
  categoryId: string;
  proficiencyLevel: VendorProficiency;
  notes: string;
}

interface Props {
  trades: TradeDraft[];
  onChange: (next: TradeDraft[]) => void;
}

const DEFAULT_PROFICIENCY: VendorProficiency = "standard";

/**
 * Vendor service-area picker. Labelled "Service areas" in the UI, but the
 * underlying entity is the `vendor_trade` table (vendor ↔ element_category
 * mapping with proficiency) — the internal `trade` naming is kept to avoid a
 * rename migration.
 *
 * Compose-then-commit, rather than a list of half-filled rows: you pick an area
 * and add it, and what's assigned reads back as a plain list. That is why
 * `TradeDraft.categoryId` is a `string` and not `string | null` — a row without
 * an area can no longer be created, so downstream code doesn't have to keep
 * asking whether this one is real yet.
 *
 * A vendor may declare zero service areas. One that IS added names a Service
 * Area (level 3), never a whole Sub-category: a vendor covering all of
 * "Cabinets" lists each area under it, which is what the list is for.
 */
export function VendorTradesEditor({ trades, onChange }: Props) {
  const t = useTranslations("vendors");
  const { tree, options } = useCategoryTree();

  const [pending, setPending] = useState<string | null>(null);
  const [pendingProficiency, setPendingProficiency] =
    useState<VendorProficiency>(DEFAULT_PROFICIENCY);

  const optionById = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options]
  );
  const usedIds = useMemo(
    () => new Set(trades.map((tr) => tr.categoryId)),
    [trades]
  );

  const duplicate = !!pending && usedIds.has(pending);

  const add = () => {
    if (!pending || duplicate) return;
    onChange([
      ...trades,
      {
        categoryId: pending,
        proficiencyLevel: pendingProficiency,
        notes: "",
      },
    ]);
    setPending(null);
    setPendingProficiency(DEFAULT_PROFICIENCY);
  };

  const setProficiency = (i: number, proficiencyLevel: VendorProficiency) =>
    onChange(
      trades.map((tr, idx) => (idx === i ? { ...tr, proficiencyLevel } : tr))
    );

  const remove = (i: number) => onChange(trades.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[13px] font-medium text-text-secondary">
        {t("tradesLabel")}
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2 items-end">
          <ServiceAreaSelect
            value={pending}
            onChange={setPending}
            tree={tree}
            renderCreate={serviceAreaCreate(tree)}
          />
          <ProficiencySelect
            value={pendingProficiency}
            onChange={setPendingProficiency}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={add}
            disabled={!pending || duplicate}
          >
            <Plus className="w-4 h-4" />
            {t("addTrade")}
          </Button>
        </div>
        {duplicate && (
          <p className="text-xs text-error">{t("duplicateTrade")}</p>
        )}
      </div>

      {trades.length === 0 ? (
        <p className="text-xs text-text-muted italic">{t("noTrades")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {trades.map((tr, i) => {
            const option = optionById.get(tr.categoryId);
            return (
              <li
                key={tr.categoryId}
                className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated px-3 py-2"
              >
                <CategoryIcon
                  icon={option?.icon}
                  color={option?.color}
                  size={14}
                />
                {/* The full path, not the bare leaf: "Base Cabinets" on its own
                    doesn't say which of them it is. */}
                <span className="flex-1 truncate text-sm text-text-primary">
                  {option?.label ?? tr.categoryId}
                </span>
                <ProficiencySelect
                  value={tr.proficiencyLevel}
                  onChange={(p) => setProficiency(i, p)}
                  compact
                />
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProficiencySelect({
  value,
  onChange,
  compact = false,
}: {
  value: VendorProficiency;
  onChange: (value: VendorProficiency) => void;
  compact?: boolean;
}) {
  const t = useTranslations("vendors");
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as VendorProficiency)}
    >
      <SelectTrigger className={compact ? "w-[150px] px-3 py-1.5" : undefined}>
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
  );
}
