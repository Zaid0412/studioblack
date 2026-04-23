"use client";

import { Plus, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BoqActionBarProps {
  onAddItem: () => void;
  onAddSection: () => void;
  disabled?: boolean;
}

/** Right-aligned PM action row above the BOQ table: add section, add item. */
export function BoqActionBar({
  onAddItem,
  onAddSection,
  disabled,
}: BoqActionBarProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onAddSection}
        disabled={disabled}
      >
        <FolderPlus className="h-4 w-4" />
        Add section
      </Button>
      <Button type="button" size="sm" onClick={onAddItem} disabled={disabled}>
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </div>
  );
}
