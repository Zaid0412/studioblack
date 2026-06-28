"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/api/routes";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
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
    <aside className="w-full lg:w-60 lg:self-start shrink-0 rounded-[10px] bg-bg-secondary border border-border-default p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
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

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
          selectedId === null
            ? "bg-accent/10 text-accent font-medium"
            : "text-text-primary hover:bg-bg-elevated"
        )}
      >
        {t("allCategories")}
      </button>

      <div className="mt-2 flex flex-col gap-0.5 flex-1">
        {isLoading ? (
          <div className="text-xs text-text-muted px-2 py-1">…</div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col gap-2 px-2 py-1">
            <span className="text-xs text-text-muted">
              {t("categoryEmpty")}
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => setStarterOpen(true)}
                className="inline-flex items-center gap-1.5 self-start text-xs text-accent hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t("starterUseSet")}
              </button>
            )}
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {canManage && <ManageCategoriesLink from="elements" />}

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

interface NodeProps {
  node: ElementCategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function TreeNode({ node, depth, selectedId, onSelect }: NodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
          isSelected
            ? "bg-accent/10 text-accent font-medium"
            : "text-text-primary hover:bg-bg-elevated"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="shrink-0 text-text-muted hover:text-text-primary"
          >
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                expanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}
        <CategoryIcon icon={node.icon} color={node.color} size={14} />
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
          aria-hidden={!expanded}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-0.5 pt-0.5">
              {node.children.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
