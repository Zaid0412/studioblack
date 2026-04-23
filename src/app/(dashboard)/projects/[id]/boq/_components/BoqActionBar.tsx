"use client";

import { Plus, FolderPlus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BoqActionBarProps {
  onAddItem: () => void;
  onAddFromLibrary: () => void;
  onAddSection: () => void;
  disabled?: boolean;
}

/** Right-aligned PM action row above the BOQ table. */
export function BoqActionBar({
  onAddItem,
  onAddFromLibrary,
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
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onAddItem}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        Add manual
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onAddFromLibrary}
        disabled={disabled}
      >
        <BookOpen className="h-4 w-4" />
        Add from library
      </Button>
    </div>
  );
}
