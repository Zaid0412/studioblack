"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Plus } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import { CategoryEditDialog } from "@/components/elements/CategoryEditDialog";
import { useCreateCategory } from "@/hooks/useCreateCategory";
import type { ElementCategoryNode } from "@/types";
import { flattenCategories } from "../_lib/categoryUtils";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  tree: ElementCategoryNode[];
  label?: string;
  /**
   * Minimum tree depth a category must have to be selectable (depth 0 =
   * level-1 category, 1 = sub-category, 2 = leaf/service area). Options
   * shallower than this are hidden — breadcrumb labels stay intact. Default 0
   * shows every level.
   */
  minDepth?: number;
  /**
   * Like `minDepth`, but shallower nodes are still *shown* — greyed out and
   * unclickable — instead of hidden. Use this when the ancestors are the only
   * thing that makes the leaves readable (an element must sit under a Service
   * Area, but "Base Cabinets" means nothing without "Kitchen › Cabinets" above
   * it), and when an existing value may itself be too shallow: a hidden option
   * would vanish from the trigger, a disabled one still renders.
   */
  selectableDepth?: number;
  /**
   * Rendered in place of the default "New category" dialog. The picker owns the
   * open state and selects whatever `onCreated` hands back.
   */
  renderCreate?: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (id: string) => void;
  }) => React.ReactNode;
  /** Trigger text when nothing is selected. Defaults to the "Uncategorized" label. */
  placeholder?: string;
  /** Show the in-dropdown "Uncategorized" reset option. Default true. */
  clearable?: boolean;
  /** Show the "New category" quick-create header. Default true; set false for filter use. */
  allowCreate?: boolean;
  /** Trigger sizing — `"sm"` matches filter-bar controls. Default `"default"`. */
  size?: "default" | "sm";
}

interface FlatOption {
  id: string;
  /** The node's own name (shown as the row label; hierarchy comes from indent). */
  name: string;
  /** Full breadcrumb path — used for search matching + as searching context. */
  label: string;
  depth: number;
  icon: string | null;
  color: string | null;
}

function flattenWithIcons(tree: ElementCategoryNode[]): FlatOption[] {
  const out: FlatOption[] = [];
  const walk = (
    nodes: ElementCategoryNode[],
    path: string[],
    depth: number
  ) => {
    for (const n of nodes) {
      const nextPath = [...path, n.name];
      out.push({
        id: n.id,
        name: n.name,
        label: nextPath.join(" › "),
        depth,
        icon: n.icon,
        color: n.color,
      });
      if (n.children.length > 0) walk(n.children, nextPath, depth + 1);
    }
  };
  walk(tree, [], 0);
  return out;
}

/**
 * Typeahead category picker. "New category" opens the shared
 * CategoryEditDialog modal so the create form lives outside the
 * parent element form (no nested <form> submission bubble).
 */
export function CategorySelect({
  value,
  onChange,
  tree,
  label,
  minDepth = 0,
  selectableDepth = 0,
  placeholder,
  clearable = true,
  allowCreate = true,
  renderCreate,
  size = "default",
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const [createOpen, setCreateOpen] = useState(false);

  const options = useMemo(
    () => flattenWithIcons(tree).filter((o) => o.depth >= minDepth),
    [tree, minDepth]
  );
  const selectedOption = value ? options.find((o) => o.id === value) : null;

  const { submitting, handleCreate } = useCreateCategory((created) => {
    onChange(created.id);
    setCreateOpen(false);
  });

  const selectCreated = (id: string) => {
    onChange(id);
    setCreateOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}
      <SearchableDropdown
        minContentWidth={280}
        maxListHeight={240}
        isEmpty={false}
        headerSlot={
          allowCreate
            ? (close) => (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setCreateOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent hover:bg-accent/10 border-b border-border-default transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {renderCreate ? t("newServiceArea") : t("newCategory")}
                </button>
              )
            : undefined
        }
        trigger={
          <button
            type="button"
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input text-sm text-text-primary",
              size === "sm" ? "px-3 py-2" : "px-4 py-3",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {selectedOption ? (
                <>
                  <CategoryIcon
                    icon={selectedOption.icon}
                    color={selectedOption.color}
                    size={14}
                  />
                  <span className="truncate">{selectedOption.label}</span>
                </>
              ) : (
                <span className="text-text-muted">
                  {placeholder ?? t("uncategorized")}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
          </button>
        }
      >
        {(query, close) => {
          const filtered = query
            ? options.filter((o) => o.label.toLowerCase().includes(query))
            : options;
          return (
            <>
              {clearable && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                    value === null && "text-accent"
                  )}
                >
                  <span className="w-4">
                    {value === null && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-text-muted">
                    {placeholder ?? t("uncategorized")}
                  </span>
                </button>
              )}
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-text-muted text-center">
                  {query ? tCommon("noResults") : t("categoryEmpty")}
                </p>
              ) : (
                filtered.map((opt) => {
                  const selected = value === opt.id;
                  // Too shallow to pick, but still rendered: the ancestors are
                  // what make the leaves legible, and an existing value that is
                  // itself too shallow must stay visible in the trigger.
                  const pickable = opt.depth >= selectableDepth;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!pickable}
                      onClick={() => {
                        onChange(opt.id);
                        close();
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
                        pickable
                          ? "hover:bg-bg-elevated"
                          : "cursor-default text-text-muted",
                        selected && "text-accent"
                      )}
                      style={{ paddingLeft: `${12 + opt.depth * 12}px` }}
                    >
                      <span className="w-4 shrink-0">
                        {selected && <Check className="h-4 w-4" />}
                      </span>
                      <CategoryIcon
                        icon={opt.icon}
                        color={opt.color}
                        size={14}
                      />
                      {/* Row shows the node's own name; hierarchy is conveyed by
                          indentation (L1 emphasised). While searching, the full
                          breadcrumb path is surfaced to disambiguate matches. */}
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "truncate",
                            opt.depth === 0 && "font-semibold"
                          )}
                        >
                          {opt.name}
                        </span>
                        {query && (
                          <span className="truncate text-[11px] text-text-muted">
                            {opt.label}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </>
          );
        }}
      </SearchableDropdown>

      {allowCreate &&
        (renderCreate ? (
          renderCreate({
            open: createOpen,
            onOpenChange: setCreateOpen,
            onCreated: selectCreated,
          })
        ) : (
          <CategoryEditDialog
            open={createOpen}
            mode="create"
            parentOptions={flattenCategories(tree)}
            submitting={submitting}
            onOpenChange={setCreateOpen}
            onSubmit={handleCreate}
          />
        ))}
    </div>
  );
}
