"use client";

import { useMemo, useState } from "react";
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
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import { elementCategories as categoriesApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import {
  STARTER_CATEGORIES,
  type StarterCategory,
} from "@/lib/categoryTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Multi-select dialog over the starter category catalogue. Submitting
 * sends the chosen entries to `/api/element-categories/bulk`, which is
 * idempotent so re-running the dialog won't create duplicates.
 *
 * Defaults: every starter category checked. Children inherit the checked
 * state of their parent on first render — uncheck a parent to drop the
 * whole branch, or expand to fine-tune individual children.
 */
export function CategoryTemplatesDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const tStart = useTranslations("elements.starterCategories");

  const initialChecked = useMemo(() => {
    const set = new Set<string>();
    for (const c of STARTER_CATEGORIES) {
      set.add(c.key);
      for (const child of c.children) set.add(`${c.key}/${child.key}`);
    }
    return set;
  }, []);

  const [checked, setChecked] = useState<Set<string>>(initialChecked);
  const [submitting, setSubmitting] = useState(false);

  const toggleParent = (parentKey: string, childKeys: string[]) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const isOn = next.has(parentKey);
      if (isOn) {
        next.delete(parentKey);
        for (const k of childKeys) next.delete(`${parentKey}/${k}`);
      } else {
        next.add(parentKey);
        for (const k of childKeys) next.add(`${parentKey}/${k}`);
      }
      return next;
    });
  };

  const toggleChild = (parentKey: string, childKey: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const id = `${parentKey}/${childKey}`;
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        next.add(parentKey);
      }
      return next;
    });
  };

  const totalSelected = checked.size;

  const handleCreate = async () => {
    const payload = STARTER_CATEGORIES.flatMap<
      | Parameters<typeof categoriesApi.bulkCreate>[0]["categories"][number]
      | null
    >((c: StarterCategory) => {
      if (!checked.has(c.key)) return [null];
      const childPayload = c.children
        .filter((child) => checked.has(`${c.key}/${child.key}`))
        .map((child) => ({
          name: tStart(`${c.key}.children.${child.key}`),
        }));
      return [
        {
          name: tStart(`${c.key}.name`),
          icon: c.icon,
          color: c.color,
          children: childPayload.length > 0 ? childPayload : undefined,
        },
      ];
    }).filter(Boolean) as Parameters<
      typeof categoriesApi.bulkCreate
    >[0]["categories"];

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
      toast({
        title: t("starterCreatedToast", {
          created: createdCount,
          skipped: skippedCount,
        }),
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

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

        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {STARTER_CATEGORIES.map((c) => {
            const childKeys = c.children.map((ch) => ch.key);
            const parentChecked = checked.has(c.key);
            return (
              <div
                key={c.key}
                className="rounded-lg border border-border-default bg-bg-input p-3"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`tpl-${c.key}`}
                    checked={parentChecked}
                    onCheckedChange={() => toggleParent(c.key, childKeys)}
                  />
                  <CategoryIcon icon={c.icon} color={c.color} size={14} />
                  <label
                    htmlFor={`tpl-${c.key}`}
                    className="flex-1 text-sm font-medium text-text-primary cursor-pointer"
                  >
                    {tStart(`${c.key}.name`)}
                  </label>
                  {c.children.length > 0 && (
                    <span className="text-xs text-text-muted">
                      {c.children.length} {t("starterChildren")}
                    </span>
                  )}
                </div>
                {c.children.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1 pl-6">
                    {c.children.map((child) => (
                      <Checkbox
                        key={child.key}
                        id={`tpl-${c.key}-${child.key}`}
                        checked={checked.has(`${c.key}/${child.key}`)}
                        onCheckedChange={() => toggleChild(c.key, child.key)}
                        label={tStart(`${c.key}.children.${child.key}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
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
            disabled={submitting || totalSelected === 0}
          >
            <Save className="h-4 w-4" />
            {submitting
              ? tCommon("loading")
              : t("starterCreateBtn", { count: totalSelected })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
