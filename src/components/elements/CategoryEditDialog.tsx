"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategoryForm,
  type CategoryFormSubmit,
  type CategoryFormValues,
} from "@/components/elements/CategoryForm";
import {
  parentCategoryOptions,
  type CategoryOption,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { CATEGORY_LEVEL } from "@/lib/categoryCode";
import type { ElementCategoryNode } from "@/types";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  editing?: ElementCategoryNode | null;
  /**
   * Forced parent when creating a child row. New subcategories inherit the
   * parent's icon / color as defaults, and their code is composed onto the
   * parent's code_prefix.
   */
  presetParent?: ElementCategoryNode | null;
  /** The full flattened tree. Filtered to Categories for the free picker. */
  parentOptions: CategoryOption[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CategoryFormSubmit) => Promise<void> | void;
}

/**
 * Shared create/edit dialog for element categories. Used by the settings
 * page, the sidebar quick-create, and the element form's category picker
 * so there is exactly one modal that owns the CategoryForm.
 */
export function CategoryEditDialog({
  open,
  mode,
  editing,
  presetParent,
  parentOptions,
  submitting,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const initial: Partial<CategoryFormValues> | undefined = editing
    ? {
        name: editing.name,
        parentId: editing.parent_id,
        codePrefix: editing.code_prefix ?? "",
        icon: editing.icon,
        color: editing.color,
      }
    : presetParent
      ? {
          parentId: presetParent.id,
          icon: presetParent.icon,
          color: presetParent.color,
        }
      : undefined;

  // The parent is only the user's to choose from the generic "New category"
  // entry point. Creating from a row's `+` fixes it to that row; editing fixes
  // it because the API cannot reparent at all (`parent_id` isn't in
  // `CATEGORY_COLS`) — the old dropdown accepted the change, dropped it, and
  // still rebased the code onto the parent you'd picked.
  const lockedParentId = editing ? editing.parent_id : presetParent?.id;
  const fixedParent =
    lockedParentId === undefined
      ? undefined
      : { parent: parentOptions.find((o) => o.id === lockedParentId) ?? null };

  const title =
    mode === "edit"
      ? tCommon("edit")
      : presetParent
        ? // A child of a Category is a Sub-category; a child of a Sub-category
          // is a Service Area (the leaf).
          presetParent.level === CATEGORY_LEVEL
          ? t("newSubcategoryUnder", { parent: presetParent.name })
          : t("newServiceAreaUnder", { parent: presetParent.name })
        : t("newCategory");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("categoryDialogHint")}</DialogDescription>
        </DialogHeader>
        <CategoryForm
          initial={initial}
          parentOptions={parentCategoryOptions(parentOptions)}
          fixedParent={fixedParent}
          isEditing={mode === "edit"}
          inUse={!!editing?.in_use}
          submitting={submitting}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
