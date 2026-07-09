"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/badge";
import { API } from "@/lib/api/routes";
import { formatCurrency } from "@/lib/formatCurrency";
import type { AvailableRate, RateMatchType } from "@/types";

const MATCH_LABEL: Record<RateMatchType, string> = {
  element: "matchElement",
  service_area: "matchServiceArea",
  ancestor: "matchAncestor",
};

interface Props {
  elementId: string;
}

/**
 * Active rate contracts that cover an element (spec §8), keyed off its service
 * area — exact-element, service-area, or ancestor matches, most-specific first.
 * Shared by the element detail page and the element edit dialog so the "which
 * contracts price this element" surface stays in one place. Studio-only (the
 * by-element endpoint is pm/architect).
 */
export function AvailableRatesPanel({ elementId }: Props) {
  const t = useTranslations("rateContracts");
  const { data, isLoading } = useSWR<{ rates: AvailableRate[] }>(
    API.rateContractsByElement(elementId)
  );
  const rates = data?.rates ?? [];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text-primary">
        {t("availableForElement")}
      </h3>
      {isLoading ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : rates.length === 0 ? (
        <p className="text-sm text-text-muted">
          {t("availableForElementEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rates.map((r) => (
            <li
              key={r.rate_contract_item_id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-text-primary">
                  {r.contract_number} · {r.vendor_name}
                </div>
                <div className="text-xs text-text-muted">{r.contract_name}</div>
              </div>
              {r.match_type && (
                <Badge variant="info">{t(MATCH_LABEL[r.match_type])}</Badge>
              )}
              <div className="shrink-0 text-right tabular-nums text-text-primary">
                {formatCurrency(r.rate, r.currency)}
                <span className="text-text-muted"> / {r.unit}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
