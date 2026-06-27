"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { Sparkles, Save } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import { elementCategories as categoriesApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import { MASTER_TAXONOMY, type SeedCategory } from "@/lib/categoryTemplates";
import type { BulkCategoryNode } from "@/lib/validations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Sub-category and service-area counts for a category, for the row summary. */
function counts(cat: SeedCategory): { subs: number; services: number } {
  const subs = cat.children?.length ?? 0;
  const services =
    cat.children?.reduce((n, s) => n + (s.children?.length ?? 0), 0) ?? 0;
  return { subs, services };
}

/**
 * Loads the standard master taxonomy (Category → Sub-category → Service Area).
 * Selection is per top-level category; checking one seeds its full subtree via
 * `/api/element-categories/bulk`, which is idempotent (re-running skips
 * anything that already exists).
 */
export function CategoryTemplatesDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const allCodes = useMemo(() => MASTER_TAXONOMY.map((c) => c.codePrefix), []);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(allCodes));
  const [submitting, setSubmitting] = useState(false);

  // Reset selections each time the dialog opens.
  useEffect(() => {
    if (open) setChecked(new Set(allCodes));
  }, [open, allCodes]);

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const handleCreate = async () => {
    const payload = MASTER_TAXONOMY.filter((c) =>
      checked.has(c.codePrefix)
    ) as BulkCategoryNode[];

    if (payload.length === 0) {
      toast({ title: t("starterNoneSelected"), variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await categoriesApi.bulkCreate({ categories: payload });
      await globalMutate(API.elementCategories());
      const createdCount = result.created.length;
      const skippedCount = result.skipped.length;
      if (createdCount === 0) {
        toast({
          title: t("starterAllSkippedToast", { skipped: skippedCount }),
          variant: "warning",
        });
      } else {
        toast({
          title: t("starterCreatedToast", {
            created: createdCount,
            skipped: skippedCount,
          }),
        });
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = checked.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            {t("starterDialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("starterDialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {MASTER_TAXONOMY.map((c) => {
            const code = c.codePrefix;
            const { subs, services } = counts(c);
            return (
              <label
                key={code}
                htmlFor={`tpl-${code}`}
                className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-input p-3 cursor-pointer"
              >
                <Checkbox
                  id={`tpl-${code}`}
                  checked={checked.has(code)}
                  onCheckedChange={() => toggle(code)}
                />
                <CategoryIcon icon={c.icon} color={c.color} size={14} />
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {c.name}
                </span>
                <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] font-mono text-text-muted">
                  {c.codePrefix}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-text-muted tabular-nums">
                      {subs} · {services}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("starterCategoryCounts", { subs, services })}
                  </TooltipContent>
                </Tooltip>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" type="button">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={submitting || selectedCount === 0}
          >
            <Save className="h-4 w-4" />
            {submitting
              ? tCommon("loading")
              : t("starterCreateBtn", { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
