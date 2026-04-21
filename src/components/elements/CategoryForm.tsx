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
import type { CategoryOption } from "@/app/(dashboard)/elements/_lib/categoryUtils";

const NONE = "__none__";

export interface CategoryFormValues {
  name: string;
  parentId: string | null;
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
  parentOptions: CategoryOption[];
  /** IDs that cannot be selected as parent (e.g. self or descendants when editing). */
  disabledParentIds?: string[];
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
  disabledParentIds = [],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) return;
    await onSubmit({
      name: values.name.trim(),
      parentId: values.parentId ?? undefined,
      codePrefix: values.codePrefix.trim() || undefined,
      icon: values.icon ?? undefined,
      color: values.color ?? undefined,
    });
  };

  const disabled = new Set(disabledParentIds);

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
          <Select
            value={values.parentId ?? NONE}
            onValueChange={(v) => setField("parentId", v === NONE ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("categoryParentNone")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("categoryParentNone")}</SelectItem>
              {parentOptions.map((opt) => (
                <SelectItem
                  key={opt.id}
                  value={opt.id}
                  disabled={disabled.has(opt.id)}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          label={t("categoryCodePrefix")}
          placeholder={t("categoryCodePrefixPlaceholder")}
          value={values.codePrefix}
          onChange={(e) => setField("codePrefix", e.target.value)}
          maxLength={10}
        />
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
