"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Package, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonList } from "@/components/ui/Skeleton";
import { rateContracts as rcApi } from "@/lib/api";
import type { AvailableRate } from "@/types";
import { formatCurrency } from "../_lib/formatters";

interface Props {
  selectedRateContractItemId: string | null;
  onSelect: (rate: AvailableRate | null) => void;
  enabled: boolean;
  /** Element IDs already in this BOQ; rows for these are disabled. */
  existingElementIds: Set<string>;
}

/** Server caps the response at 200 rows; mirror so the hint matches. */
const RESULT_CAP = 200;

/**
 * Browse-mode rate-contract picker. Shows every active rate-contract item
 * across the org. Selecting a row gives the parent dialog a full
 * `AvailableRate` so it can call `addElement` with both the element and
 * rate-contract IDs.
 */
export function BoqRateContractPicker({
  selectedRateContractItemId,
  onSelect,
  enabled,
  existingElementIds,
}: Props) {
  const t = useTranslations("rateContracts");
  const [search, setSearch] = useState("");

  const key = enabled ? rcApi.availableRatesKey(search || undefined) : null;
  const { data, isLoading } = useSWR<{ rates: AvailableRate[] }>(key);
  // Memoised so the empty-array fallback is stable; otherwise `rates` is a
  // fresh `[]` on every render and the downstream `useMemo` deps churn. The
  // browse list only adds elements to the BOQ, so it's element-bearing rates
  // only (service-area rates apply to existing items via the by-element match).
  const rates = useMemo(
    () =>
      (data?.rates ?? []).filter(
        (r): r is AvailableRate & { element_id: string } =>
          r.element_id !== null
      ),
    [data?.rates]
  );

  /**
   * Lowest rate per element across all visible contracts. When two
   * contracts cover the same element, only the cheapest gets the
   * "Lowest" badge — gives the PM a quick visual cue.
   */
  const cheapestByElement = useMemo(() => {
    const byElement = new Map<string, number>();
    for (const r of rates) {
      const cur = byElement.get(r.element_id);
      if (cur === undefined || r.rate < cur)
        byElement.set(r.element_id, r.rate);
    }
    return byElement;
  }, [rates]);

  const isCapped = rates.length >= RESULT_CAP;

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        placeholder={t("boqPickerSearchPlaceholder")}
        debounceMs={200}
        onDebouncedChange={setSearch}
      />

      <div className="min-h-[280px] max-h-[360px] overflow-y-auto rounded-lg border border-border-default bg-bg-elevated">
        {isLoading && rates.length === 0 ? (
          <SkeletonList />
        ) : rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted gap-2">
            <Package className="h-5 w-5" />
            <span>{t("boqPickerEmpty")}</span>
          </div>
        ) : (
          <ul className="flex flex-col">
            {rates.map((r) => {
              const active =
                r.rate_contract_item_id === selectedRateContractItemId;
              const inBoq = existingElementIds.has(r.element_id);
              const isCheapest = cheapestByElement.get(r.element_id) === r.rate;
              const showLowestBadge =
                isCheapest &&
                rates.filter((other) => other.element_id === r.element_id)
                  .length > 1;
              return (
                <li key={r.rate_contract_item_id}>
                  <button
                    type="button"
                    onClick={() => !inBoq && onSelect(active ? null : r)}
                    disabled={inBoq}
                    title={inBoq ? t("boqPickerAlreadyInBoq") : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border-default last:border-b-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      active
                        ? "bg-accent/10"
                        : inBoq
                          ? ""
                          : "hover:bg-bg-secondary/60 cursor-pointer"
                    }`}
                  >
                    <span className="flex-shrink-0 w-[80px] text-xs font-mono text-text-muted truncate">
                      {r.element_code}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-text-primary truncate">
                          {r.element_name}
                        </span>
                        {showLowestBadge && (
                          <Badge
                            variant="success"
                            className="shrink-0 text-[10px] px-1.5 py-0"
                          >
                            {t("boqPickerLowestBadge")}
                          </Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-text-muted">
                        <Tag className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{r.vendor_name}</span>
                        <span className="text-text-muted">·</span>
                        <span className="font-mono truncate">
                          {r.contract_number}
                        </span>
                      </span>
                    </span>
                    <span className="flex-shrink-0 w-[50px] text-xs text-text-muted text-right">
                      {r.unit}
                    </span>
                    <span className="flex-shrink-0 w-[100px] text-xs text-text-primary text-right tabular-nums font-medium">
                      {formatCurrency(r.rate, r.currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isCapped && (
        <p className="text-[11px] text-text-muted italic">
          {t("boqPickerResultCapped", { count: RESULT_CAP })}
        </p>
      )}
    </div>
  );
}
