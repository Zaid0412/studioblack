"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { ChevronRight, Plus, Settings, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/api/routes";
import { elementCategories } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import {
  CategoryForm,
  type CategoryFormSubmit,
} from "@/components/elements/CategoryForm";
import { useUserRole } from "@/hooks/useUserRole";
import { features } from "@/config/features";
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
  const { role } = useUserRole();
  const { data, isLoading } = useSWR<TreeResponse>(API.elementCategories());
  const tree = data?.tree ?? [];

  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canManage =
    features.elementLibrary && (role === "pm" || role === "architect");

  const handleCreate = async (values: CategoryFormSubmit) => {
    setSubmitting(true);
    try {
      await elementCategories.create(values);
      await globalMutate(API.elementCategories());
      toast({ title: t("categoryCreatedToast") });
      setCreating(false);
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
    <aside className="w-full lg:w-60 shrink-0 rounded-[10px] bg-bg-secondary border border-border-default p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-text-secondary">
          {t("allCategories")}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("newCategory")}
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-3">
          <CategoryForm
            mode="create"
            parentOptions={flattenCategories(tree)}
            submitting={submitting}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

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
          <div className="text-xs text-text-muted px-2 py-1">
            {t("categoryEmpty")}
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

      {canManage && (
        <>
          <div className="my-3 h-px bg-border-default" />
          <Link
            href="/settings/element-categories"
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[12px] text-accent hover:bg-accent/10 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              {t("manageCategories")}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
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
      {hasChildren && expanded && (
        <div className="flex flex-col gap-0.5">
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
      )}
    </div>
  );
}
