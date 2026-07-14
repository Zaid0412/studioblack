"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import {
  CategoryPickerEmpty,
  CategoryRow,
  CategoryTrigger,
} from "@/components/elements/CategoryPickerParts";
import { flattenCategories } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import type { ElementCategoryNode } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  tree: ElementCategoryNode[];
}

/**
 * Category filter for the Elements + Vendors list bars.
 *
 * Flat and any-level on purpose, where `ServiceAreaSelect` drills and takes only
 * leaves: filtering by "Kitchen" — everything under it — is one of the things
 * people most want, and a cascade would make it cost three picks to say. A
 * filter also can't produce bad data, which is the whole reason the picker
 * cascades. So: every node clickable, indented, searchable on the full path.
 */
export function CategoryFilterSelect({ value, onChange, tree }: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const options = useMemo(() => flattenCategories(tree), [tree]);
  const selected = (value && options.find((o) => o.id === value)) || null;

  return (
    <SearchableDropdown
      minContentWidth={280}
      maxListHeight={240}
      isEmpty={false}
      trigger={
        <CategoryTrigger
          selected={selected}
          placeholder={t("allCategories")}
          compact
        />
      }
    >
      {(query, close) => {
        const filtered = query
          ? options.filter((o) => o.label.toLowerCase().includes(query))
          : options;
        const pick = (id: string | null) => {
          onChange(id);
          close();
        };
        return (
          <>
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                value === null && "text-accent"
              )}
            >
              <span className="w-4">
                {value === null && <Check className="h-4 w-4" />}
              </span>
              <span className="text-text-muted">{t("allCategories")}</span>
            </button>
            {filtered.length === 0 ? (
              <CategoryPickerEmpty>
                {query ? tCommon("noResults") : t("categoryEmpty")}
              </CategoryPickerEmpty>
            ) : (
              filtered.map((opt) => (
                <CategoryRow
                  key={opt.id}
                  icon={opt.icon}
                  color={opt.color}
                  name={opt.name}
                  // Rows show the node's own name — the indent carries the
                  // hierarchy. Searching leaves no indent to read, so the full
                  // path is surfaced to disambiguate matches.
                  path={query ? opt.label : undefined}
                  indent={opt.depth}
                  emphasis={opt.depth === 0}
                  selected={value === opt.id}
                  onClick={() => pick(opt.id)}
                />
              ))
            )}
          </>
        );
      }}
    </SearchableDropdown>
  );
}
