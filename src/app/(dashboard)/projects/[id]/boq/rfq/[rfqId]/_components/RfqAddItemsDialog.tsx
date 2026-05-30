"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBoq } from "@/hooks/useBoq";
import { useRfqMutations } from "@/hooks/useRfqs";
import type { BoqItemWithComputed } from "@/types";
import { BoqItemsPickerTable } from "../../_components/BoqItemsPickerTable";

interface Props {
  projectId: string;
  rfqId: string;
  /** IDs of BOQ items already on this RFQ — excluded from the picker. */
  excludeBoqItemIds: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Add-items dialog. Same UX as the BOQ-items picker on the create flow,
 * but pre-filters out items already on the RFQ so the user only sees
 * candidates. Submitting calls the new POST .../items endpoint.
 */
export function RfqAddItemsDialog({
  projectId,
  rfqId,
  excludeBoqItemIds,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const t = useTranslations("rfq.addItems");
  const { boq, isLoading: boqLoading } = useBoq(projectId);
  const { addItems } = useRfqMutations(projectId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Reset on every open so a cancel doesn't leak picks into the next session.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const excluded = useMemo(
    () => new Set(excludeBoqItemIds),
    [excludeBoqItemIds]
  );
  const candidates: BoqItemWithComputed[] = useMemo(
    () => (boq?.items ?? []).filter((it) => !excluded.has(it.id)),
    [boq?.items, excluded]
  );

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === candidates.length
        ? new Set()
        : new Set(candidates.map((i) => i.id))
    );
  };

  const canSubmit = selected.size > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = candidates
      .filter((it) => selected.has(it.id))
      .map((it) => ({
        boqItemId: it.id,
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        specNotes: null,
      }));
    const res = await addItems(rfqId, { items: payload });
    setSubmitting(false);
    if (res) {
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { count: selected.size })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border-default bg-bg-input max-h-[420px] overflow-y-auto">
          {boqLoading ? (
            <p className="px-4 py-8 text-sm text-text-muted text-center">
              {t("loading")}
            </p>
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("empty")}
              description={t("emptyHint")}
            />
          ) : (
            <BoqItemsPickerTable
              items={candidates}
              selected={selected}
              onToggleItem={toggleItem}
              onToggleAll={toggleAll}
              labels={{
                selectAll: t("selectAll"),
                code: t("col.code"),
                description: t("col.description"),
                unit: t("col.unit"),
                quantity: t("col.quantity"),
              }}
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={submitting}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("confirm", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
