"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { Check, ChevronDown, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { toast } from "@/components/ui/useToast";
import { elementCategories as categoriesApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import {
  CATEGORY_CODE_SEGMENT_MIN,
  composeCategoryCode,
  isSegmentTooShort,
  nextAutoSegment,
  normalizeCodeSegment,
  segmentCap,
} from "@/lib/categoryCode";
import { useCodeConfig } from "@/hooks/useCodeConfig";
import { cn } from "@/lib/utils";
import type { CategoryCreateRender } from "@/components/elements/ServiceAreaSelect";
import type { CategoryCodeConfig, ElementCategoryNode } from "@/types";

/** Sentinel for "I'm creating this level rather than picking an existing one". */
const NEW = "__new__";

interface Props {
  open: boolean;
  tree: ElementCategoryNode[];
  onOpenChange: (open: boolean) => void;
  /** Receives the id of the Service Area, created or reused. */
  onCreated: (id: string) => void;
}

/**
 * `renderCreate` for a `ServiceAreaSelect` — used by elements, vendor trades and
 * rate-contract items alike. The generic category form deliberately can't reach
 * level 3, so a picker that accepts only Service Areas has to create them
 * through this chain builder.
 *
 * Exists so the three call sites don't each re-thread the same four props.
 */
export function serviceAreaCreate(
  tree: ElementCategoryNode[]
): CategoryCreateRender {
  return function ServiceAreaCreate({ open, onOpenChange, onCreated }) {
    return (
      <ServiceAreaDialog
        open={open}
        tree={tree}
        onOpenChange={onOpenChange}
        onCreated={onCreated}
      />
    );
  };
}

interface Rung {
  /** Existing node id, or NEW. */
  pick: string;
  name: string;
  segment: string;
  /** True once the user edits the code segment — stops name-driven auto-fill. */
  codeTouched: boolean;
}

const EMPTY_RUNG: Rung = {
  pick: NEW,
  name: "",
  segment: "",
  codeTouched: false,
};

/**
 * Fill a new rung's code segment from its name when the org auto-generates and
 * the user hasn't edited the code — re-deriving from the full name on every
 * keystroke (see `nextAutoSegment`).
 */
function useAutoFillRung(
  rung: Rung,
  setRung: React.Dispatch<React.SetStateAction<Rung>>,
  config: CategoryCodeConfig
) {
  useEffect(() => {
    const segment = nextAutoSegment(
      {
        name: rung.name,
        segment: rung.segment,
        isNew: rung.pick === NEW,
        codeTouched: rung.codeTouched,
      },
      config
    );
    if (segment !== null) setRung((r) => ({ ...r, segment }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rung.name,
    rung.pick,
    rung.codeTouched,
    config.auto_generate,
    config.code_max_length,
  ]);
}

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
  const { config } = useCodeConfig();

  const [category, setCategory] = useState<Rung>(EMPTY_RUNG);
  const [subcategory, setSubcategory] = useState<Rung>(EMPTY_RUNG);
  const [serviceArea, setServiceArea] = useState<Rung>(EMPTY_RUNG);
  const [submitting, setSubmitting] = useState(false);

  // Auto-suggest each new rung's code from its name (when the org auto-generates
  // and the user hasn't set one).
  useAutoFillRung(category, setCategory, config);
  useAutoFillRung(subcategory, setSubcategory, config);
  useAutoFillRung(serviceArea, setServiceArea, config);

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

  const categoryPrefix = categoryNode
    ? (categoryNode.code_prefix ?? "")
    : composeCategoryCode(null, category.segment);
  const subPrefix = subNode
    ? (subNode.code_prefix ?? "")
    : composeCategoryCode(categoryPrefix, subcategory.segment);
  const serviceAreaPrefix = composeCategoryCode(subPrefix, serviceArea.segment);

  // A picked rung needs nothing more; a new one needs a name plus a code
  // segment. A non-empty segment must clear the minimum length (so `K` can't be
  // saved); an empty one is only allowed when the org auto-generates. The
  // Service Area is always new, so this covers it too.
  const rungReady = (rung: Rung) => {
    if (rung.pick !== NEW) return true;
    const seg = rung.segment.trim();
    const segOk =
      seg.length >= CATEGORY_CODE_SEGMENT_MIN ||
      (seg === "" && config.auto_generate);
    return !!rung.name.trim() && segOk;
  };
  const ready = [category, subcategory, serviceArea].every(rungReady);

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

      // Refresh the tree BEFORE handing the id back: the picker renders from
      // this cache, so selecting an id it hasn't seen yet would leave the field
      // looking empty until SWR happened to revalidate on its own.
      await globalMutate(API.elementCategories());
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
          <DialogDescription>{t("newServiceAreaHint")}</DialogDescription>
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
            parentReady
            autoGenerate={config.auto_generate}
            codeMaxLength={config.code_max_length}
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
            parentReady={rungReady(category)}
            autoGenerate={config.auto_generate}
            codeMaxLength={config.code_max_length}
          />

          {/* The Service Area is a rung with nothing to pick from — it is always
              new, which is the entire point of the dialog. */}
          <RungFields
            label={t("categoryLevel3")}
            rung={serviceArea}
            onChange={setServiceArea}
            options={[]}
            parentPrefix={subPrefix}
            namePlaceholder={t("serviceAreaNamePlaceholder")}
            parentReady={rungReady(subcategory)}
            autoGenerate={config.auto_generate}
            codeMaxLength={config.code_max_length}
          />

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
  /** Existing nodes to pick from. Empty means this rung can only be created. */
  options: ElementCategoryNode[];
  parentPrefix: string | null;
  namePlaceholder: string;
  onChange: (next: Rung) => void;
  /** The rung above is settled, so this one can be filled in. */
  parentReady: boolean;
  /** When the org auto-generates codes, the segment field isn't required. */
  autoGenerate: boolean;
  /** The org's `code_max_length` — caps the segment input at the setting. */
  codeMaxLength: number;
  newLabel?: string;
  onPick?: (pick: string) => void;
}

/**
 * One rung of the chain: pick an existing node, or name a new one.
 *
 * With no options there is nothing to pick, so the rung goes straight to the
 * create fields. That covers both the Service Area (always new) and a
 * Sub-category under a brand-new Category, which has no children to offer.
 */
function RungFields({
  label,
  rung,
  options,
  parentPrefix,
  namePlaceholder,
  onChange,
  parentReady,
  autoGenerate,
  codeMaxLength,
  newLabel,
  onPick,
}: RungProps) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const pickable = options.length > 0;
  const creating = !pickable || rung.pick === NEW;
  const picked = options.find((o) => o.id === rung.pick);

  // Progressive reveal: a rung stays hidden until the one above it is filled,
  // so we never render a bare label with no field beneath it.
  if (!parentReady) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-text-secondary">
        {label}
      </label>

      {pickable && (
        <SearchableDropdown
          minContentWidth={280}
          maxListHeight={240}
          isEmpty={false}
          headerSlot={(close) => (
            <button
              type="button"
              onClick={() => {
                onPick?.(NEW);
                close();
              }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent-strong hover:bg-accent/10 border-b border-border-default transition-colors"
            >
              <Plus className="h-4 w-4" />
              {newLabel}
            </button>
          )}
          trigger={
            <button
              type="button"
              className="flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30"
            >
              <span className="truncate">
                {picked ? (
                  <>
                    {picked.name}
                    {picked.code_prefix ? ` (${picked.code_prefix})` : ""}
                  </>
                ) : (
                  <span className="text-accent-strong">{newLabel}</span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
            </button>
          }
        >
          {(query, close) => {
            const filtered = query
              ? options.filter((o) =>
                  `${o.name} ${o.code_prefix ?? ""}`
                    .toLowerCase()
                    .includes(query)
                )
              : options;
            if (filtered.length === 0) {
              return (
                <p className="px-3 py-4 text-sm text-text-muted text-center">
                  {tCommon("noResults")}
                </p>
              );
            }
            return filtered.map((opt) => {
              const selected = rung.pick === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onPick?.(opt.id);
                    close();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                    selected && "text-accent-strong"
                  )}
                >
                  <span className="w-4 shrink-0">
                    {selected && <Check className="h-4 w-4" />}
                  </span>
                  <span className="truncate">
                    {opt.name}
                    {opt.code_prefix ? (
                      <span className="text-text-muted">
                        {" "}
                        ({opt.code_prefix})
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            });
          }}
        </SearchableDropdown>
      )}

      {creating && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Both are mandatory — `rungReady` gates Save on a name AND a code
                segment for every rung being created. */}
            <Input
              label={t("categoryNameLabel")}
              placeholder={namePlaceholder}
              value={rung.name}
              onChange={(e) => onChange({ ...rung, name: e.target.value })}
              maxLength={150}
              required
            />
            <Input
              label={t("categoryCodeSegment")}
              placeholder={t("categoryCodeSegmentPlaceholder")}
              value={rung.segment}
              onChange={(e) => {
                const segment = normalizeCodeSegment(e.target.value);
                // Typing a code stops auto-fill; clearing it back to empty
                // resumes name-driven auto-fill.
                onChange({ ...rung, segment, codeTouched: segment !== "" });
              }}
              maxLength={segmentCap(parentPrefix, codeMaxLength)}
              required={!autoGenerate}
            />
          </div>
          {isSegmentTooShort(rung.segment) && (
            <p className="text-xs text-warning">
              {t("categoryCodeMinHint", { min: CATEGORY_CODE_SEGMENT_MIN })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
