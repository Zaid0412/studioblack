"use client";

import {
  Plus,
  FolderPlus,
  BookOpen,
  Download,
  Upload,
  CheckSquare,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface BoqActionBarProps {
  onAddItem: () => void;
  onAddFromLibrary: () => void;
  onAddSection: () => void;
  onImport: () => void;
  onExport: () => void;
  exporting?: boolean;
  disabled?: boolean;
  /** When false, only the bulk-select toggle renders (used by the client view). */
  canEdit?: boolean;
  /** When provided, renders a "Select" toggle that flips the table into bulk-select mode. */
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
}

/**
 * Right-aligned action row above the BOQ table. The add actions collapse into a
 * single "Add" menu and the Excel import/export into a "More" menu, so the bar
 * stays to three controls instead of six. Edit controls hide when `canEdit` is
 * false — the client view keeps only the bulk-select toggle.
 */
export function BoqActionBar({
  onAddItem,
  onAddFromLibrary,
  onAddSection,
  onImport,
  onExport,
  exporting,
  disabled,
  canEdit = true,
  selectionMode,
  onToggleSelectionMode,
}: BoqActionBarProps) {
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {onToggleSelectionMode && (
        <Button
          type="button"
          variant={selectionMode ? "primary" : "secondary"}
          size="sm"
          onClick={onToggleSelectionMode}
          disabled={disabled}
          aria-pressed={selectionMode}
        >
          <CheckSquare className="h-4 w-4" />
          {/* Fixed-width label so the bg-color transition isn't disturbed
              by a width snap when "Select" → "Selecting" flips. */}
          <span className="inline-block min-w-[58px] text-left">
            {selectionMode ? "Selecting" : "Select"}
          </span>
        </Button>
      )}
      {canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary" size="sm">
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onExport} disabled={exporting}>
                <Upload className="h-4 w-4" />
                {exporting ? "Exporting…" : "Export to Excel"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onImport} disabled={disabled}>
                <Download className="h-4 w-4" />
                Import from Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" disabled={disabled}>
                <Plus className="h-4 w-4" />
                Add
                <ChevronDown className="h-4 w-4 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onAddFromLibrary}>
                <BookOpen className="h-4 w-4" />
                From element library…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddItem}>
                <Plus className="h-4 w-4" />
                New manual line
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddSection}>
                <FolderPlus className="h-4 w-4" />
                New section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
