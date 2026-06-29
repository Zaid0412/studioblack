"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Plus, Sparkles } from "lucide-react";
import { API } from "@/lib/api/routes";
import { CategoryFilterTree } from "@/components/elements/CategoryFilterTree";
import { CategoryEditDialog } from "@/components/elements/CategoryEditDialog";
import { ManageCategoriesLink } from "@/components/elements/ManageCategoriesLink";
import { CategoryTemplatesDialog } from "./CategoryTemplatesDialog";
import { useCreateCategory } from "@/hooks/useCreateCategory";
import { useCanManageCategories } from "@/hooks/useCanManageCategories";
import type { ElementCategoryNode } from "@/types";
import { flattenCategories } from "../_lib/categoryUtils";

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface TreeResponse {
  tree: ElementCategoryNode[];
}

/** Read-only category tree with header quick-create + footer settings link. */
export function CategoryTreeSidebar({ selectedId, onSelect }: Props) {
  const t = useTranslations("elements");
  const { canManage } = useCanManageCategories();
  const { data, isLoading } = useSWR<TreeResponse>(API.elementCategories());
  const tree = data?.tree ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [starterOpen, setStarterOpen] = useState(false);

  const { submitting, handleCreate } = useCreateCategory(() =>
    setCreateOpen(false)
  );

  return (
    <aside className="w-full lg:w-60 shrink-0 rounded-[10px] bg-bg-secondary border border-border-default lg:self-stretch lg:relative">
      {/* On desktop the content fills the box absolutely so the box matches the
          height of the element list beside it; the tree scrolls when it overflows. */}
      <div className="flex flex-col p-3 lg:absolute lg:inset-0">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-[13px] font-medium text-text-secondary">
            {t("categories")}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("newCategory")}
            </button>
          )}
        </div>

        <CategoryFilterTree
          tree={tree}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={onSelect}
          allLabel={t("allCategories")}
          emptyLabel={t("categoryEmpty")}
          emptyExtra={
            canManage ? (
              <button
                type="button"
                onClick={() => setStarterOpen(true)}
                className="inline-flex items-center gap-1.5 self-start text-xs text-accent hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t("starterUseSet")}
              </button>
            ) : undefined
          }
        />

        {canManage && <ManageCategoriesLink from="elements" />}
      </div>

      <CategoryEditDialog
        open={createOpen}
        mode="create"
        parentOptions={flattenCategories(tree)}
        submitting={submitting}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      <CategoryTemplatesDialog
        open={starterOpen}
        onOpenChange={setStarterOpen}
      />
    </aside>
  );
}
