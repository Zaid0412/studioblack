"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { CategoryColorPicker } from "./CategoryColorPicker";
import {
  codeSegmentOf,
  composeCategoryCode,
  maxSegmentLength,
} from "@/lib/categoryCode";
import {
  categoryPrefixOf,
  type CategoryOption,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";

const NONE = "__none__";

export interface CategoryFormValues {
  name: string;
  parentId: string | null;
  /** Full path code (`KIT-CAB-BASE`). The form edits only its last segment. */
  codePrefix: string;
  icon: string | null;
  color: string | null;
}

export interface CategoryFormSubmit {
  name: string;
  parentId?: string;
  codePrefix?: string;
  icon?: string;
  color?: string;
}

interface Props {
  initial?: Partial<CategoryFormValues>;
  /**
   * Selectable parents. Hosts pass top-level Categories only
   * (`parentCategoryOptions`), so this form creates a Category or a
   * Sub-category — never a Service Area. Also used to resolve a parent's
   * `codePrefix`, so it must still contain `fixedParent` when that is set.
   */
  parentOptions: CategoryOption[];
  /**
   * Parent is decided by the caller and cannot be changed here: creating from a
   * row's `+` (the row IS the parent), or editing (the API can't reparent — see
   * `CATEGORY_COLS`). Rendered as text instead of a picker, because a dropdown
   * that silently discards your choice is worse than no dropdown.
   */
  lockParent?: boolean;
  /**
   * The locked parent — `null` means "no parent" (a top-level Category). Passed
   * as the option rather than looked up, because a locked parent may be a
   * Sub-category, which `parentOptions` deliberately excludes.
   */
  fixedParent?: CategoryOption | null;
  submitting: boolean;
  onSubmit: (values: CategoryFormSubmit) => Promise<void> | void;
  onCancel: () => void;
}

const EMPTY: CategoryFormValues = {
  name: "",
  parentId: null,
  codePrefix: "",
  icon: null,
  color: null,
};

/**
 * Reusable category create/edit form. Hosts the icon + color pickers and a
 * parent selector so the same component backs the sidebar quick-create,
 * the settings-page dialog, and the inline dialog popover.
 */
export function CategoryForm({
  initial,
  parentOptions,
  lockParent = false,
  fixedParent = null,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const [values, setValues] = useState<CategoryFormValues>({
    ...EMPTY,
    ...initial,
  });

  useEffect(() => {
    setValues({ ...EMPTY, ...initial });
    // Only reset when switching between editing targets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.name, initial?.parentId, initial?.codePrefix]);

  const setField = <K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) => setValues((v) => ({ ...v, [key]: value }));

  // A category's code is its parent's code plus its own segment, so the form
  // only ever edits the segment — `KIT-CAB` + `BASE` → `KIT-CAB-BASE`. Element
  // codes are built from this, so a hand-typed path that didn't sit under its
  // parent would silently break them. State holds the composed code; the
  // segment is derived for display, so a parent switch re-bases it for free.
  //
  // A locked parent may be a Sub-category, which `parentOptions` excludes — so
  // read its prefix off the option we were handed rather than looking it up.
  const prefixOf = (id: string | null) =>
    lockParent
      ? (fixedParent?.codePrefix?.trim() ?? null)
      : categoryPrefixOf(parentOptions, id);
  const parentPrefix = prefixOf(values.parentId);
  const codeSegment = codeSegmentOf(values.codePrefix, parentPrefix);

  /** Re-base the code onto the new parent, keeping the segment the user typed. */
  const selectParent = (parentId: string | null) =>
    setValues((v) => ({
      ...v,
      parentId,
      codePrefix: composeCategoryCode(prefixOf(parentId), codeSegment),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Stop the synthetic submit from bubbling up the React tree.
    // CategoryForm is hosted in dialogs that are themselves nested inside
    // outer forms (e.g. BoqCreateItemSheet). Radix portals the dialog DOM
    // to body, but React events bubble through the component tree — so
    // without this, clicking Save here also submits the outer form.
    e.stopPropagation();
    if (!values.name.trim()) return;
    await onSubmit({
      name: values.name.trim(),
      parentId: values.parentId ?? undefined,
      codePrefix: values.codePrefix.trim() || undefined,
      icon: values.icon ?? undefined,
      color: values.color ?? undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-secondary p-3"
    >
      <Input
        label={t("categoryName")}
        placeholder={t("categoryNamePlaceholder")}
        value={values.name}
        onChange={(e) => setField("name", e.target.value)}
        required
        maxLength={150}
        autoFocus
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-text-secondary">
            {t("categoryParent")}
          </label>
          {lockParent ? (
            <p className="flex min-h-9 items-center text-sm text-text-primary">
              {fixedParent?.label ?? t("categoryParentNone")}
            </p>
          ) : (
            <>
              <Select
                value={values.parentId ?? NONE}
                onValueChange={(v) => selectParent(v === NONE ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("categoryParentNone")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {t("categoryParentNone")}
                  </SelectItem>
                  {parentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-muted">
                {t("categoryParentHint")}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label={t("categoryCodeSegment")}
            placeholder={t("categoryCodeSegmentPlaceholder")}
            value={codeSegment}
            onChange={(e) =>
              setField(
                "codePrefix",
                composeCategoryCode(parentPrefix, e.target.value)
              )
            }
            maxLength={maxSegmentLength(parentPrefix)}
          />
          <p className="text-xs text-text-muted">
            {values.codePrefix
              ? t("categoryCodeComposed", { code: values.codePrefix })
              : t("categoryCodeHint")}
          </p>
        </div>
      </div>

      <CategoryIconPicker
        label={t("categoryIcon")}
        value={values.icon}
        onChange={(v) => setField("icon", v)}
        color={values.color}
      />

      <CategoryColorPicker
        label={t("categoryColor")}
        value={values.color}
        onChange={(v) => setField("color", v)}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
          {tCommon("cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitting || !values.name.trim()}
        >
          <Save className="h-4 w-4" />
          {submitting ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
