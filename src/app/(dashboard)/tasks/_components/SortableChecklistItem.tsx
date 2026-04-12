"use client";

import { GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChecklistItem } from "../_hooks/useTaskDetail";

/** Drag-sortable checklist item with toggle and delete controls. */
export function SortableChecklistItem({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 group py-1.5 px-1 rounded hover:bg-bg-elevated/50"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-0 shrink-0 text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing transition-colors touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onToggle(item)}
        className={`w-4 h-4 rounded-[3px] border shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
          item.is_done
            ? "bg-accent border-accent"
            : "border-text-muted hover:border-text-secondary"
        }`}
      >
        {item.is_done && (
          <svg
            className="w-3 h-3 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>
      <span
        className={`text-[13px] flex-1 ${
          item.is_done ? "text-text-muted line-through" : "text-text-secondary"
        }`}
      >
        {item.title}
      </span>
      <button
        onClick={() => onDelete(item)}
        className="lg:opacity-0 lg:group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
