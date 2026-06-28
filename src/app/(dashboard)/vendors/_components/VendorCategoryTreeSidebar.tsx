"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { API } from "@/lib/api/routes";
import { CategoryFilterTree } from "@/components/elements/CategoryFilterTree";
import { ManageCategoriesLink } from "@/components/elements/ManageCategoriesLink";
import { useCanManageCategories } from "@/hooks/useCanManageCategories";
import type { ElementCategoryNode } from "@/types";

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface TreeResponse {
  tree: ElementCategoryNode[];
}

/**
 * Category tree for the vendors page. Reuses the shared element category tree
 * (vendors map to it via `vendor_trade`); selecting a node filters vendors to
 * that category and — server-side — its descendants. Management is the shared
 * element-category editor: PM/architects get a "Manage categories" link to it
 * (the tree is the same one the Elements library uses).
 */
export function VendorCategoryTreeSidebar({ selectedId, onSelect }: Props) {
  const t = useTranslations("vendors");
  const { canManage } = useCanManageCategories();
  const { data, isLoading } = useSWR<TreeResponse>(API.elementCategories());
  const tree = data?.tree ?? [];

  return (
    <aside className="w-full lg:w-60 shrink-0 rounded-[10px] bg-bg-secondary border border-border-default lg:self-stretch lg:relative">
      {/* On desktop the content fills the box absolutely so the box matches the
          height of the vendor list beside it; the tree scrolls when it overflows. */}
      <div className="flex flex-col p-3 lg:absolute lg:inset-0">
        <span className="shrink-0 text-[13px] font-medium text-text-secondary mb-2">
          {t("categories")}
        </span>

        <CategoryFilterTree
          tree={tree}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={onSelect}
          allLabel={t("allCategories")}
          emptyLabel={t("categoryEmpty")}
        />

        {canManage && (
          <ManageCategoriesLink
            from="vendors"
            hint={t("categoriesSharedHint")}
          />
        )}
      </div>
    </aside>
  );
}
