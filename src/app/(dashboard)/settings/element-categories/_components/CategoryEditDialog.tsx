"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategoryForm,
  type CategoryFormSubmit,
  type CategoryFormValues,
} from "@/components/elements/CategoryForm";
import type { CategoryOption } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import type { ElementCategoryNode } from "@/types";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  editing: ElementCategoryNode | null;
  /** Forced parent when creating a child row. */
  presetParentId?: string | null;
  parentOptions: CategoryOption[];
  /** IDs that cannot be selected as parent (self + descendants when editing). */
  disabledParentIds?: string[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CategoryFormSubmit) => Promise<void> | void;
}

export function CategoryEditDialog({
  open,
  mode,
  editing,
  presetParentId,
  parentOptions,
  disabledParentIds,
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
    : presetParentId !== undefined
      ? { parentId: presetParentId }
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? tCommon("edit") : t("newCategory")}
          </DialogTitle>
        </DialogHeader>
        <CategoryForm
          initial={initial}
          parentOptions={parentOptions}
          disabledParentIds={disabledParentIds}
          submitting={submitting}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
