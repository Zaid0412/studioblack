"use client";

import type React from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ElementCategoryNode } from "@/types";

const INDENT_PX = 20;
const CONNECTOR_COLOR = "var(--border-default)";
const CONNECTOR_WIDTH = 2;

interface Props {
  node: ElementCategoryNode;
  depth: number;
  onEdit: (node: ElementCategoryNode) => void;
  onDelete: (node: ElementCategoryNode) => void;
  onAddChild: (parent: ElementCategoryNode) => void;
  onToggleCollapse: (id: string) => void;
  /** Disable add-child when the node is already at level 3 (max nesting). */
  canAddChild: boolean;
  hasChildren: boolean;
  isLastSibling: boolean;
  isCollapsed: boolean;
}

/** D2 curved elbow connector drawn with CSS borders. */
function TreeConnector({
  depth,
  isLastSibling,
}: {
  depth: number;
  isLastSibling: boolean;
}) {
  const left = (depth - 1) * INDENT_PX + 10;
  // End the horizontal stroke at the centre of the collapse chevron. The
  // chevron/spacer starts at `depth * INDENT_PX` from the td's left edge and is
  // 18px wide; the connector box is `left` from the td, so its width covers the
  // gap in between.
  const horizontalEndX = depth * INDENT_PX + 9;
  const width = horizontalEndX - left;
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left,
          top: 0,
          width,
          // ~py-2 (8px) lands at the top of the grip icon.
          height: 10,
          borderLeft: `${CONNECTOR_WIDTH}px solid ${CONNECTOR_COLOR}`,
          borderBottom: `${CONNECTOR_WIDTH}px solid ${CONNECTOR_COLOR}`,
          borderBottomLeftRadius: 4,
        }}
      />
      {!isLastSibling && (
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left,
            top: 10,
            width: CONNECTOR_WIDTH,
            height: "calc(100% - 10px)",
            background: CONNECTOR_COLOR,
          }}
        />
      )}
    </>
  );
}

/** Typography tuned per nesting depth (L1/L2/L3). */
function nameClassForDepth(depth: number): string {
  if (depth === 0) return "text-sm font-semibold text-text-primary truncate";
  if (depth === 1) return "text-[13px] text-text-primary truncate";
  return "text-xs text-text-secondary truncate";
}

/** Single row in the element-category tree: drag handle, indent connector, name, counts, and action buttons. */
export function CategoryTableRow({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  onToggleCollapse,
  canAddChild,
  hasChildren,
  isLastSibling,
  isCollapsed,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const style: React.CSSProperties = {
    // Unique per-row name so the View Transitions API can tween position
    // changes when siblings collapse/expand. CSS identifiers can't contain
    // raw hyphens from UUIDs in certain positions, so we only strip them
    // as a safety net — the `cat-row-` prefix already ensures a valid start.
    viewTransitionName: `cat-row-${node.id.replace(/-/g, "")}`,
  };

  const updatedRel = new Date(node.updated_at).toLocaleDateString();

  return (
    <tr
      data-anim-item
      style={style}
      className="border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors"
    >
      <td className="py-2 pr-3 relative">
        {depth > 0 && (
          <TreeConnector depth={depth} isLastSibling={isLastSibling} />
        )}
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: `${depth * INDENT_PX}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleCollapse(node.id)}
              aria-label={isCollapsed ? tCommon("expand") : tCommon("collapse")}
              aria-expanded={!isCollapsed}
              className="shrink-0 cursor-pointer rounded p-0.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-150",
                  isCollapsed && "-rotate-90"
                )}
              />
            </button>
          ) : (
            <span aria-hidden className="w-[18px] shrink-0" />
          )}
          <CategoryIcon icon={node.icon} color={node.color} size={16} />
          <span className={nameClassForDepth(depth)}>{node.name}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary">
        {node.code_prefix ?? "—"}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary">
        {node.element_count ?? 0}
      </td>
      <td className="py-2 px-3 text-sm text-text-muted">{updatedRel}</td>
      <td className="py-2 pl-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          {canAddChild &&
            (() => {
              // A child of a level-1 category is a sub-category; a child of a
              // level-2 sub-category is a service area (the leaf).
              const addLabel =
                node.level === 1 ? t("addSubcategory") : t("addServiceArea");
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddChild(node)}
                      aria-label={addLabel}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{addLabel}</TooltipContent>
                </Tooltip>
              );
            })()}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(node)}
                aria-label={tCommon("edit")}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tCommon("edit")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(node)}
                aria-label={tCommon("delete")}
                className="text-error hover:text-error"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tCommon("delete")}</TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}
