"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/useToast";
import { elementCategories as categoriesApi } from "@/lib/api";
import {
  composeCategoryCode,
  maxSegmentLength,
  normalizeCodeSegment,
} from "@/lib/categoryCode";
import type { ElementCategoryNode } from "@/types";

/** Sentinel for "I'm creating this level rather than picking an existing one". */
const NEW = "__new__";

interface Props {
  open: boolean;
  tree: ElementCategoryNode[];
  onOpenChange: (open: boolean) => void;
  /** Receives the id of the Service Area, created or reused. */
  onCreated: (id: string) => void;
}

interface Rung {
  /** Existing node id, or NEW. */
  pick: string;
  name: string;
  segment: string;
}

const EMPTY_RUNG: Rung = { pick: NEW, name: "", segment: "" };

/**
 * Builds the Category → Sub-category → Service Area chain an element needs,
 * without leaving the element form.
 *
 * Each of the two upper rungs is either picked from what already exists or
 * typed fresh; the Service Area itself is always new. The whole chain is sent
 * to the idempotent bulk-create, which reuses the rungs that already exist and
 * inserts only what's missing — so "Kitchen › Cabinets › Corner Units" costs
 * one round-trip whether none, some, or all of its ancestors were there.
 */
export function ServiceAreaDialog({
  open,
  tree,
  onOpenChange,
  onCreated,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const [category, setCategory] = useState<Rung>(EMPTY_RUNG);
  const [subcategory, setSubcategory] = useState<Rung>(EMPTY_RUNG);
  const [serviceArea, setServiceArea] = useState<Rung>(EMPTY_RUNG);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(EMPTY_RUNG);
    setSubcategory(EMPTY_RUNG);
    setServiceArea(EMPTY_RUNG);
  }, [open]);

  const categoryNode =
    category.pick === NEW ? null : tree.find((c) => c.id === category.pick);
  const subOptions = categoryNode?.children ?? [];
  const subNode =
    subcategory.pick === NEW
      ? null
      : subOptions.find((c) => c.id === subcategory.pick);

  // A new Category has no children, so its Sub-category must be new too.
  const forceNewSub = category.pick === NEW;

  const categoryPrefix = categoryNode
    ? (categoryNode.code_prefix ?? "")
    : composeCategoryCode(null, category.segment);
  const subPrefix = subNode
    ? (subNode.code_prefix ?? "")
    : composeCategoryCode(categoryPrefix, subcategory.segment);
  const serviceAreaPrefix = composeCategoryCode(subPrefix, serviceArea.segment);

  const rungReady = (rung: Rung) =>
    rung.pick !== NEW || (!!rung.name.trim() && !!rung.segment.trim());
  const ready =
    rungReady(category) &&
    rungReady(subcategory) &&
    !!serviceArea.name.trim() &&
    !!serviceArea.segment.trim();

  const selectCategory = (pick: string) => {
    setCategory({ ...EMPTY_RUNG, pick });
    // The sub-category list is scoped to the category — a stale pick from the
    // previous one would be a child of the wrong parent.
    setSubcategory(EMPTY_RUNG);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The dialog is portaled but React events still bubble through the tree,
    // and it's hosted inside the element form — don't submit that too.
    e.stopPropagation();
    if (!ready || submitting) return;

    setSubmitting(true);
    try {
      const { leafIds } = await categoriesApi.bulkCreate({
        categories: [
          {
            name: categoryNode?.name ?? category.name.trim(),
            codePrefix: categoryPrefix,
            children: [
              {
                name: subNode?.name ?? subcategory.name.trim(),
                codePrefix: subPrefix,
                children: [
                  {
                    name: serviceArea.name.trim(),
                    codePrefix: serviceAreaPrefix,
                  },
                ],
              },
            ],
          },
        ],
      });

      const id = leafIds[0];
      if (!id) throw new Error(t("serviceAreaCreateFailed"));
      onCreated(id);
    } catch (err) {
      toast({
        title: t("serviceAreaCreateFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("newServiceArea")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <RungFields
            label={t("categoryLevel1")}
            rung={category}
            onChange={setCategory}
            onPick={selectCategory}
            options={tree}
            parentPrefix={null}
            newLabel={t("newCategory")}
            namePlaceholder={t("categoryNamePlaceholder")}
          />

          <RungFields
            label={t("categoryLevel2")}
            rung={subcategory}
            onChange={setSubcategory}
            onPick={(pick) => setSubcategory({ ...EMPTY_RUNG, pick })}
            options={subOptions}
            parentPrefix={categoryPrefix}
            newLabel={t("newSubcategory")}
            namePlaceholder={t("categoryNamePlaceholder")}
            forceNew={forceNewSub}
            disabled={!rungReady(category)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("categoryLevel3")}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder={t("serviceAreaNamePlaceholder")}
                value={serviceArea.name}
                onChange={(e) =>
                  setServiceArea((v) => ({ ...v, name: e.target.value }))
                }
                maxLength={150}
              />
              <Input
                placeholder={t("categoryCodeSegmentPlaceholder")}
                value={serviceArea.segment}
                onChange={(e) =>
                  setServiceArea((v) => ({
                    ...v,
                    segment: normalizeCodeSegment(e.target.value),
                  }))
                }
                maxLength={maxSegmentLength(subPrefix)}
              />
            </div>
          </div>

          <p className="text-xs text-text-muted">
            {serviceAreaPrefix
              ? t("categoryCodeComposed", { code: serviceAreaPrefix })
              : t("categoryCodeHint")}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              {tCommon("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !ready}>
              <Save className="h-4 w-4" />
              {submitting ? tCommon("loading") : tCommon("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RungProps {
  label: string;
  rung: Rung;
  options: ElementCategoryNode[];
  parentPrefix: string | null;
  newLabel: string;
  namePlaceholder: string;
  onChange: (next: Rung) => void;
  onPick: (pick: string) => void;
  /** No existing options can apply — the parent is itself brand new. */
  forceNew?: boolean;
  disabled?: boolean;
}

/** One rung of the chain: pick an existing node, or name a new one. */
function RungFields({
  label,
  rung,
  options,
  parentPrefix,
  newLabel,
  namePlaceholder,
  onChange,
  onPick,
  forceNew = false,
  disabled = false,
}: RungProps) {
  const t = useTranslations("elements");
  const creating = forceNew || rung.pick === NEW;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-text-secondary">
        {label}
      </label>

      {!forceNew && (
        <Select
          value={rung.pick}
          onValueChange={onPick}
          disabled={disabled || options.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("categoryParentNone")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW}>{newLabel}</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
                {opt.code_prefix ? ` (${opt.code_prefix})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {creating && !disabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder={namePlaceholder}
            value={rung.name}
            onChange={(e) => onChange({ ...rung, name: e.target.value })}
            maxLength={150}
          />
          <Input
            placeholder={t("categoryCodeSegmentPlaceholder")}
            value={rung.segment}
            onChange={(e) =>
              onChange({
                ...rung,
                segment: normalizeCodeSegment(e.target.value),
              })
            }
            maxLength={maxSegmentLength(parentPrefix)}
          />
        </div>
      )}
    </div>
  );
}
