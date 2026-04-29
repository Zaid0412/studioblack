"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Package, Tag } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { rateContracts as rcApi } from "@/lib/api";
import type { AvailableRate } from "@/types";
import { formatCurrency } from "../_lib/formatters";

interface Props {
  selectedRateContractItemId: string | null;
  onSelect: (rate: AvailableRate | null) => void;
  enabled: boolean;
}

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
}: Props) {
  const t = useTranslations("rateContracts");
  const [search, setSearch] = useState("");

  const key = enabled ? rcApi.availableRatesKey(search || undefined) : null;
  const { data, isLoading } = useSWR<{ rates: AvailableRate[] }>(key);
  const rates = data?.rates ?? [];

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        placeholder={t("boqPickerSearchPlaceholder")}
        debounceMs={200}
        onDebouncedChange={setSearch}
      />

      <div className="min-h-[280px] max-h-[360px] overflow-y-auto rounded-lg border border-border-default bg-bg-elevated">
        {isLoading && rates.length === 0 ? (
          <div className="flex flex-col gap-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded" />
            ))}
          </div>
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
              return (
                <li key={r.rate_contract_item_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(active ? null : r)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border-default last:border-b-0 transition-colors cursor-pointer ${
                      active ? "bg-accent/10" : "hover:bg-bg-secondary/60"
                    }`}
                  >
                    <span className="flex-shrink-0 w-[80px] text-xs font-mono text-text-muted truncate">
                      {r.element_code}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-text-primary truncate">
                        {r.element_name}
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
    </div>
  );
}
