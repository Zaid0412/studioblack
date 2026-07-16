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
  suggestCodeSegment,
} from "@/lib/categoryCode";
import {
  categoryPrefixOf,
  type CategoryOption,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { useCodeConfig } from "@/hooks/useCodeConfig";

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
   * (`parentCategoryOptions`), so the picker creates a Category or a
   * Sub-category — never a Service Area.
   */
  parentOptions: CategoryOption[];
  /**
   * Present ⇒ the parent is the caller's decision, not the user's: creating
   * from a row's `+` (the row IS the parent), or editing (the API cannot
   * reparent — `parent_id` isn't in `CATEGORY_COLS`). Rendered as a disabled
   * input rather than a picker, because a dropdown that discards your choice is
   * worse than no dropdown.
   *
   * Wrapped so "locked to no parent" (`{ parent: null }`, a top-level Category)
   * stays distinguishable from "not locked" (`undefined`). The option is passed
   * rather than looked up because a locked parent may be a Sub-category, which
   * `parentOptions` deliberately excludes.
   */
  fixedParent?: { parent: CategoryOption | null };
  /** Editing an existing category — disables auto-fill of the code from the name. */
  isEditing?: boolean;
  /** The category is referenced by live data — locks the code when the org opts in. */
  inUse?: boolean;
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
  fixedParent,
  isEditing = false,
  inUse = false,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const { config } = useCodeConfig();

  const [values, setValues] = useState<CategoryFormValues>({
    ...EMPTY,
    ...initial,
  });
  // When editing, the code already exists — never auto-fill it from the name.
  const [codeTouched, setCodeTouched] = useState(isEditing);

  useEffect(() => {
    setValues({ ...EMPTY, ...initial });
    setCodeTouched(isEditing);
    // Only reset when switching between editing targets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.name, initial?.parentId, initial?.codePrefix]);

  // A category's code is locked once it's in use (when the org opts into it).
  const codeLocked = isEditing && inUse && config.lock_after_use;

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
    fixedParent
      ? (fixedParent.parent?.codePrefix?.trim() ?? null)
      : categoryPrefixOf(parentOptions, id);
  const parentPrefix = prefixOf(values.parentId);
  const codeSegment = codeSegmentOf(values.codePrefix, parentPrefix);

  // The per-segment cap: the org's max length, but never past the room left
  // under the 20-char composed ceiling.
  const segmentCap =
    Math.min(config.code_max_length, maxSegmentLength(parentPrefix)) ||
    config.code_max_length;

  // Auto-suggest the code from the name while creating and the user hasn't
  // touched the code field. Recomputes on name/parent change; the first keystroke
  // in the code field stops it.
  useEffect(() => {
    if (isEditing || codeTouched || !config.auto_generate) return;
    const seg = suggestCodeSegment(values.name, segmentCap);
    setValues((v) => ({
      ...v,
      codePrefix: seg ? composeCategoryCode(parentPrefix, seg) : "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.name,
    parentPrefix,
    config.auto_generate,
    segmentCap,
    codeTouched,
  ]);

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
      // Only send a code the user actually chose. When untouched under
      // auto-generate, omit it so the server generates + dedupes authoritatively.
      codePrefix: codeTouched
        ? values.codePrefix.trim() || undefined
        : undefined,
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
        {fixedParent ? (
          <Input
            label={t("categoryParent")}
            value={fixedParent.parent?.label ?? t("categoryParentNone")}
            disabled
            readOnly
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("categoryParent")}
            </label>
            <Select
              value={values.parentId ?? NONE}
              onValueChange={(v) => selectParent(v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("categoryParentNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("categoryParentNone")}</SelectItem>
                {parentOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-muted">{t("categoryParentHint")}</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Input
            label={t("categoryCodeSegment")}
            placeholder={t("categoryCodeSegmentPlaceholder")}
            value={codeSegment}
            onChange={(e) => {
              setCodeTouched(true);
              setField(
                "codePrefix",
                composeCategoryCode(parentPrefix, e.target.value)
              );
            }}
            maxLength={segmentCap}
            disabled={codeLocked}
            readOnly={codeLocked}
          />
          <p className="text-xs text-text-muted">
            {codeLocked
              ? t("categoryCodeLocked")
              : values.codePrefix
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
