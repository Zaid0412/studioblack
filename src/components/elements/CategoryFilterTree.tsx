"use client";

import { useState } from "react";
import type React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import type { ElementCategoryNode } from "@/types";

interface Props {
  tree: ElementCategoryNode[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Label for the "everything" reset row (e.g. "All categories"). */
  allLabel: string;
  /** Message when the tree is empty. */
  emptyLabel: string;
  /** Extra content under the empty message (e.g. a "use a starter set" button). */
  emptyExtra?: React.ReactNode;
}

/**
 * Shared category filter tree for the Elements + Vendors sidebars: an "All" reset
 * row plus the collapsible category tree (selecting a node filters the list).
 * Both render the same shared `element_category` tree. The tree area scrolls on
 * desktop so the sidebar matches the height of the list beside it.
 */
export function CategoryFilterTree({
  tree,
  isLoading,
  selectedId,
  onSelect,
  allLabel,
  emptyLabel,
  emptyExtra,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
          selectedId === null
            ? "bg-accent/10 text-accent-strong font-medium"
            : "text-text-primary hover:bg-bg-elevated"
        )}
      >
        {allLabel}
      </button>

      <div className="mt-2 flex flex-col gap-0.5 flex-1 lg:min-h-0 lg:overflow-y-auto">
        {isLoading ? (
          <div className="text-xs text-text-muted px-2 py-1">…</div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col gap-2 px-2 py-1">
            <span className="text-xs text-text-muted">{emptyLabel}</span>
            {emptyExtra}
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
    </>
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
            ? "bg-accent/10 text-accent-strong font-medium"
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
