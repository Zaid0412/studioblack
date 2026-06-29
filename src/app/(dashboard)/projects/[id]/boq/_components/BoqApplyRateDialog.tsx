"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Check, Loader2, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/useToast";
import { boq as boqApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { formatCurrency } from "@/lib/formatCurrency";
import type {
  AvailableRate,
  BoqItemWithComputed,
  RateMatchType,
} from "@/types";

interface Props {
  projectId: string;
  /** The item to apply a rate to; null closes the dialog. */
  item: BoqItemWithComputed | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful apply so the caller can refresh the BOQ. */
  onApplied: () => void;
}

const MATCH_LABEL_KEY: Record<RateMatchType, string> = {
  element: "matchElement",
  service_area: "matchServiceArea",
  ancestor: "matchAncestor",
};

const MATCH_VARIANT: Record<RateMatchType, "success" | "info" | "archived"> = {
  element: "success",
  service_area: "info",
  ancestor: "archived",
};

/**
 * Lists the rate-contract rates that cover a BOQ item's element (exact element,
 * its service area, or an ancestor category) and applies the chosen one to the
 * item. The match engine + precedence live server-side in `getByElement`.
 */
export function BoqApplyRateDialog({
  projectId,
  item,
  onOpenChange,
  onApplied,
}: Props) {
  const t = useTranslations("rateContracts");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data, isLoading } = useSWR<{ rates: AvailableRate[] }>(
    item?.element_id ? API.rateContractsByElement(item.element_id) : null
  );
  const rates = data?.rates ?? [];

  const handleApply = async (rate: AvailableRate) => {
    if (!item) return;
    setApplyingId(rate.rate_contract_item_id);
    try {
      await boqApi.applyRate(projectId, item.id, {
        rateContractItemId: rate.rate_contract_item_id,
        updatedAt: item.updated_at,
      });
      toast({ title: t("applyToastSuccess"), variant: "success" });
      onApplied();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t("applyToastError"),
        variant: "error",
      });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("applyDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("applyDialogDescription", {
              item: item?.item_code || item?.name || "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[160px] max-h-[360px] overflow-y-auto rounded-lg border border-border-default">
          {isLoading ? (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : rates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted gap-2">
              <Package className="h-5 w-5" />
              <span>{t("applyDialogEmpty")}</span>
            </div>
          ) : (
            <ul className="flex flex-col">
              {rates.map((r) => {
                const isApplying = applyingId === r.rate_contract_item_id;
                const isApplied =
                  item?.rate_contract_item_id === r.rate_contract_item_id;
                return (
                  <li key={r.rate_contract_item_id}>
                    <button
                      type="button"
                      disabled={applyingId !== null || isApplied}
                      onClick={() => void handleApply(r)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {r.vendor_name}
                          </span>
                          {r.match_type && (
                            <Badge
                              variant={MATCH_VARIANT[r.match_type]}
                              className="shrink-0"
                            >
                              {t(MATCH_LABEL_KEY[r.match_type])}
                            </Badge>
                          )}
                          {isApplied && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-xs text-success">
                              <Check className="h-3.5 w-3.5" />
                              {t("applyApplied")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          {r.contract_number} ·{" "}
                          {r.category_code ?? r.category_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-mono text-text-primary shrink-0">
                        {isApplying && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {formatCurrency(r.rate, r.currency)}
                        <span className="text-text-muted">/{r.unit}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
