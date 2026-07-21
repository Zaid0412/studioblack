"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/formatCurrency";
import type { RateContractItemWithTarget } from "@/types";

interface Props {
  items: RateContractItemWithTarget[];
  currency: string;
  canRemove: boolean;
  /**
   * When true, clicking the rate cell turns it into an editable input.
   * Disabled on non-draft contracts to prevent silent re-pricing of items
   * that may already be referenced by BOQs.
   */
  canEditRate: boolean;
  onRemove: (item: RateContractItemWithTarget) => void;
  onEditRate?: (
    item: RateContractItemWithTarget,
    newRate: number
  ) => Promise<void>;
}

/** Tabular line-item list for a rate contract with per-row remove + inline rate edit. */
export function RateContractItemTable({
  items,
  currency,
  canRemove,
  canEditRate,
  onRemove,
  onEditRate,
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
      <div className="hidden lg:grid grid-cols-[1fr_1fr_100px_140px_60px] gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide">
        <div>{t("colServiceArea")}</div>
        <div>{t("colElement")}</div>
        <div>{t("colItemUnit")}</div>
        <div className="text-right">{t("colItemRate")}</div>
        <div className="text-right">{t("colActions")}</div>
      </div>
      <div className="flex flex-col">
        {items.map((it, idx) => (
          <div
            key={it.id}
            className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_100px_140px_60px] gap-2 lg:gap-4 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-text-muted shrink-0 tabular-nums">
                {idx + 1}
              </span>
              {it.category_code && (
                <span className="font-mono text-xs text-text-muted shrink-0">
                  {it.category_code}
                </span>
              )}
              <span className="text-sm text-text-primary truncate">
                {it.category_name}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {it.element_id ? (
                  <>
                    <span className="font-mono text-xs text-text-muted shrink-0">
                      {it.element_code}
                    </span>
                    <span className="text-sm text-text-primary truncate">
                      {it.element_name}
                    </span>
                    {it.element_archived && (
                      <Badge variant="archived" className="shrink-0">
                        {t("itemArchived")}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-text-muted italic">
                    {t("itemWholeArea")}
                  </span>
                )}
              </div>
              {(() => {
                const meta = [
                  it.description,
                  it.lead_time_days != null
                    ? `${t("colLeadTime")} ${it.lead_time_days}d`
                    : null,
                  it.min_qty != null || it.max_qty != null
                    ? `${t("colQtyRange")} ${it.min_qty ?? "—"}–${it.max_qty ?? "—"}`
                    : null,
                  it.tax_pct != null ? `${t("colTax")} ${it.tax_pct}%` : null,
                  it.valid_until ? `→ ${it.valid_until.slice(0, 10)}` : null,
                  it.notes ? `${t("itemNotes")}: ${it.notes}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return meta ? (
                  <div className="text-xs text-text-muted truncate">{meta}</div>
                ) : null;
              })()}
            </div>
            <div className="text-sm text-text-secondary">{it.unit}</div>
            <RateCell
              item={it}
              currency={currency}
              canEdit={canEditRate && !!onEditRate}
              onSave={onEditRate}
            />
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

interface RateCellProps {
  item: RateContractItemWithTarget;
  currency: string;
  canEdit: boolean;
  onSave?: (item: RateContractItemWithTarget, newRate: number) => Promise<void>;
}

function RateCell({ item, currency, canEdit, onSave }: RateCellProps) {
  const t = useTranslations("rateContracts");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(item.rate));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, item.rate]);

  if (!canEdit || !onSave) {
    return (
      <div className="text-sm text-text-primary lg:text-right font-mono">
        {formatCurrency(Number(item.rate), currency)}
      </div>
    );
  }

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  const commit = async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next <= 0) {
      cancel();
      return;
    }
    if (next === Number(item.rate)) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(item, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="lg:text-right">
        <Input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0.01"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") cancel();
          }}
          className="w-32 h-9 px-3 py-2 text-right font-mono"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={t("editRateTooltip")}
      aria-label={tCommon("edit")}
      className="text-sm text-text-primary lg:text-right font-mono cursor-pointer hover:text-accent-strong transition-colors w-full lg:w-auto"
    >
      {formatCurrency(Number(item.rate), currency)}
    </button>
  );
}
