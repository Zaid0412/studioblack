"use client";

import { Plus, FolderPlus, BookOpen, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BoqActionBarProps {
  onAddItem: () => void;
  onAddFromLibrary: () => void;
  onAddSection: () => void;
  onImport: () => void;
  onExport: () => void;
  exporting?: boolean;
  disabled?: boolean;
}

/** Right-aligned PM action row above the BOQ table. */
export function BoqActionBar({
  onAddItem,
  onAddFromLibrary,
  onAddSection,
  onImport,
  onExport,
  exporting,
  disabled,
}: BoqActionBarProps) {
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onExport}
        disabled={exporting}
      >
        <Download className="h-4 w-4" />
        {exporting ? "Exporting…" : "Export Excel"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onImport}
        disabled={disabled}
      >
        <Upload className="h-4 w-4" />
        Import Excel
      </Button>
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
