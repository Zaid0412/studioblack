"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/api/routes";
import type { ElementCategoryNode } from "@/types";

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface TreeResponse {
  tree: ElementCategoryNode[];
}

/** Read-only category tree. Clicking a node filters the element list. */
export function CategoryTreeSidebar({ selectedId, onSelect }: Props) {
  const t = useTranslations("elements");
  const { data, isLoading } = useSWR<TreeResponse>(API.elementCategories());
  const tree = data?.tree ?? [];

  return (
    <aside className="w-full lg:w-60 shrink-0 rounded-[10px] bg-bg-secondary border border-border-default p-3">
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

      <div className="mt-2 flex flex-col gap-0.5">
        {isLoading ? (
          <div className="text-xs text-text-muted px-2 py-1">…</div>
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
          <Folder className="w-3.5 h-3.5 text-text-muted shrink-0" />
        )}
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
