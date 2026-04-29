"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Layers } from "lucide-react";
import type { RateContractItemWithElement } from "@/types";

interface Props {
  items: RateContractItemWithElement[];
  currency: string;
  canRemove: boolean;
  onRemove: (item: RateContractItemWithElement) => void;
}

const CURRENCY_FORMAT = new Map<string, Intl.NumberFormat>();
function formatRate(value: number, currency: string): string {
  let f = CURRENCY_FORMAT.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    CURRENCY_FORMAT.set(currency, f);
  }
  return f.format(value);
}

export function RateContractItemTable({
  items,
  currency,
  canRemove,
  onRemove,
}: Props) {
  const t = useTranslations("rateContracts");

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title={t("itemsEmptyTitle")}
        description={t("itemsEmptyHint")}
      />
    );
  }

  return (
    <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden">
      <div className="hidden lg:grid grid-cols-[140px_1fr_100px_140px_60px] gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide">
        <div>{t("colItemCode")}</div>
        <div>{t("colItemName")}</div>
        <div>{t("colItemUnit")}</div>
        <div className="text-right">{t("colItemRate")}</div>
        <div className="text-right">{t("colActions")}</div>
      </div>
      <div className="flex flex-col">
        {items.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-1 lg:grid-cols-[140px_1fr_100px_140px_60px] gap-2 lg:gap-4 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors"
          >
            <div className="font-mono text-sm text-text-primary truncate">
              {it.element_code}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-text-primary truncate">
                {it.element_name}
              </span>
              {it.element_archived && (
                <Badge variant="archived" className="shrink-0">
                  {t("itemArchived")}
                </Badge>
              )}
            </div>
            <div className="text-sm text-text-secondary">{it.unit}</div>
            <div className="text-sm text-text-primary lg:text-right font-mono">
              {formatRate(Number(it.rate), currency)}
            </div>
            <div className="flex items-center lg:justify-end">
              {canRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("removeItem")}
                  onClick={() => onRemove(it)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
