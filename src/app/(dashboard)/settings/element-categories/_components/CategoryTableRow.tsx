"use client";

import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ElementCategoryNode } from "@/types";

interface Props {
  node: ElementCategoryNode;
  depth: number;
  onEdit: (node: ElementCategoryNode) => void;
  onDelete: (node: ElementCategoryNode) => void;
  onAddChild: (parent: ElementCategoryNode) => void;
  /** Disable add-child when the node is already at level 3 (max nesting). */
  canAddChild: boolean;
}

export function CategoryTableRow({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  canAddChild,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const updatedRel = new Date(node.updated_at).toLocaleDateString();

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors",
        isDragging && "bg-bg-elevated"
      )}
    >
      <td className="py-2 pr-3">
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Reorder"
            className="shrink-0 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <CategoryIcon icon={node.icon} color={node.color} size={16} />
          <span className="text-sm text-text-primary truncate">
            {node.name}
          </span>
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
          {canAddChild && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddChild(node)}
              aria-label="Add child category"
              title="Add child"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(node)}
            aria-label="Edit category"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(node)}
            aria-label="Delete category"
            title="Delete"
            className="text-error hover:text-error"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
