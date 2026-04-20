"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/useToast";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import {
  CategoryForm,
  type CategoryFormSubmit,
} from "@/components/elements/CategoryForm";
import { API } from "@/lib/api/routes";
import { elementCategories } from "@/lib/api";
import type { ElementCategory, ElementCategoryNode } from "@/types";
import { flattenCategories } from "../_lib/categoryUtils";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  tree: ElementCategoryNode[];
  label?: string;
}

interface FlatOption {
  id: string;
  label: string;
  depth: number;
  icon: string | null;
  color: string | null;
}

function flattenWithIcons(tree: ElementCategoryNode[]): FlatOption[] {
  const out: FlatOption[] = [];
  const walk = (nodes: ElementCategoryNode[], path: string[], depth: number) => {
    for (const n of nodes) {
      const nextPath = [...path, n.name];
      out.push({
        id: n.id,
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
 * Typeahead category picker with inline "Create new category" flow.
 * Built on Popover rather than Select so the dropdown can host the
 * full CategoryForm without leaving the element dialog.
 */
export function CategorySelect({ value, onChange, tree, label }: Props) {
  const t = useTranslations("elements");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => flattenWithIcons(tree), [tree]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedOption = value ? options.find((o) => o.id === value) : null;

  const handleCreate = async (values: CategoryFormSubmit) => {
    setSubmitting(true);
    try {
      const created = (await elementCategories.create(values)) as ElementCategory;
      await globalMutate(API.elementCategories());
      toast({ title: t("categoryCreatedToast") });
      onChange(created.id);
      setCreating(false);
      setOpen(false);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setCreating(false);
            setQuery("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-4 py-2.5 text-sm text-text-primary",
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
                <span className="text-text-muted">{t("allCategories")}</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        >
          {creating ? (
            <div className="p-2">
              <CategoryForm
                mode="create"
                parentOptions={flattenCategories(tree)}
                submitting={submitting}
                onSubmit={handleCreate}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent hover:bg-accent/10 border-b border-border-default transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t("newCategory")}
              </button>

              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full bg-transparent pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none border-b border-border-default"
                />
              </div>

              <div className="max-h-[240px] overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                    value === null && "text-accent"
                  )}
                >
                  <span className="w-4">{value === null && <Check className="h-4 w-4" />}</span>
                  <span className="text-text-muted">—</span>
                </button>
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-text-muted text-center">
                    {t("noResults")}
                  </p>
                ) : (
                  filtered.map((opt) => {
                    const selected = value === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onChange(opt.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
                          selected && "text-accent"
                        )}
                        style={{ paddingLeft: `${12 + opt.depth * 12}px` }}
                      >
                        <span className="w-4 shrink-0">
                          {selected && <Check className="h-4 w-4" />}
                        </span>
                        <CategoryIcon icon={opt.icon} color={opt.color} size={14} />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
