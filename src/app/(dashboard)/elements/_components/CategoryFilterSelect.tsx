"use client";

import { useTranslations } from "next-intl";
import { CategorySelect } from "./CategorySelect";
import type { ElementCategoryNode } from "@/types";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  tree: ElementCategoryNode[];
}

/**
 * Inline category filter dropdown for the Elements + Vendors list filter bars.
 * Thin wrapper around `CategorySelect` in read-only "filter" mode: no create
 * action, compact trigger, and an "All categories" empty/reset label.
 */
export function CategoryFilterSelect({ value, onChange, tree }: Props) {
  const t = useTranslations("elements");
  return (
    <CategorySelect
      value={value}
      onChange={onChange}
      tree={tree}
      allowCreate={false}
      size="sm"
      placeholder={t("allCategories")}
    />
  );
}
