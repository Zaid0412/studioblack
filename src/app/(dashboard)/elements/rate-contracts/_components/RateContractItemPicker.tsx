"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { elements as elementsApi } from "@/lib/api";
import type { ListElementsResponse } from "@/lib/api/elements";
import type { Element } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractCurrency: string;
  /** Element ids already in the contract — disabled in the picker. */
  existingElementIds: Set<string>;
  onSubmit: (
    rows: { elementId: string; unit: string; rate: number }[]
  ) => Promise<void>;
}

interface DraftRow {
  element: Element;
  rate: string;
  unit: string;
}

export function RateContractItemPicker({
  open,
  onOpenChange,
  contractCurrency,
  existingElementIds,
  onSubmit,
}: Props) {
  const t = useTranslations("rateContracts");
  const tCommon = useTranslations("common");

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDrafts([]);
    }
  }, [open]);

  const listKey = open
    ? elementsApi.listKey({
        search: search || undefined,
        isActive: true,
        limit: 25,
      })
    : null;
  const { data } = useSWR<ListElementsResponse>(listKey);
  const elements = data?.rows ?? [];

  const addDraft = (element: Element) => {
    if (drafts.some((d) => d.element.id === element.id)) return;
    setDrafts((s) => [...s, { element, rate: "", unit: element.unit }]);
  };

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((s) =>
      s.map((d) => (d.element.id === id ? { ...d, ...patch } : d))
    );
  };

  const removeDraft = (id: string) => {
    setDrafts((s) => s.filter((d) => d.element.id !== id));
  };

  const canSubmit =
    drafts.length > 0 &&
    drafts.every((d) => d.rate.trim() && Number(d.rate) >= 0) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(
        drafts.map((d) => ({
          elementId: d.element.id,
          unit: d.unit,
          rate: Number(d.rate),
        }))
      );
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("itemPickerTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <SearchInput
            placeholder={t("itemPickerSearchPlaceholder")}
            value={search}
            debounceMs={300}
            onDebouncedChange={setSearch}
          />

          <div className="border border-border-default rounded-lg max-h-[260px] overflow-y-auto">
            {elements.length === 0 ? (
              <p className="p-4 text-sm text-text-muted italic">
                {t("itemPickerEmpty")}
              </p>
            ) : (
              elements.map((el) => {
                const inContract = existingElementIds.has(el.id);
                const inDraft = drafts.some((d) => d.element.id === el.id);
                return (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => !inContract && !inDraft && addDraft(el)}
                    disabled={inContract || inDraft}
                    className="w-full text-left px-3 py-2 border-b border-border-default last:border-b-0 hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    <span className="font-mono text-xs text-text-muted w-32 truncate">
                      {el.code}
                    </span>
                    <span className="flex-1 text-sm text-text-primary truncate">
                      {el.name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {inContract
                        ? t("itemPickerInContract")
                        : inDraft
                          ? t("itemPickerInDraft")
                          : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {drafts.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("itemPickerDraftHeader", { count: drafts.length })}
              </h4>
              {drafts.map((d) => (
                <div
                  key={d.element.id}
                  className="flex items-center gap-2 rounded-md border border-border-default p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-text-muted">
                      {d.element.code}
                    </div>
                    <div className="text-sm text-text-primary truncate">
                      {d.element.name}
                    </div>
                  </div>
                  <Input
                    value={d.unit}
                    onChange={(e) =>
                      updateDraft(d.element.id, { unit: e.target.value })
                    }
                    className="w-20"
                    maxLength={30}
                  />
                  <Input
                    value={d.rate}
                    onChange={(e) =>
                      updateDraft(d.element.id, { rate: e.target.value })
                    }
                    placeholder={t("itemPickerRatePlaceholder", {
                      currency: contractCurrency,
                    })}
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-32"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDraft(d.element.id)}
                    aria-label={t("removeItem")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={submitting}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? tCommon("loading") : t("itemPickerSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
