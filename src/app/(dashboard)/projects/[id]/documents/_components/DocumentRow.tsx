"use client";

import { memo, useMemo, useRef } from "react";
import {
  Check,
  Download,
  FileText,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { formatFileSize, getFileExtension } from "@/lib/fileUtils";
import { relativeTime } from "@/lib/formatTime";
import { HighlightedText } from "./HighlightedText";
import { SectionIcon } from "./SectionIcon";
import { sectionFullPath } from "./sectionTree";

interface DocumentRowProps {
  doc: DbProjectDocument;
  sections: DbProjectDocumentSection[];
  onOpen: () => void;
  onEdit: () => void;
  onMove: (sectionId: string) => void;
  onDownload: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onUploadNewVersion: () => void;
  canEdit: boolean;
  /** When true, render the doc's section name as a small badge. Used in All view. */
  showSectionBadge?: boolean;
  /** Filename + description matches get highlighted when this is non-empty. */
  searchQuery?: string;
  /** This row is part of the current bulk-selection set. */
  isSelected?: boolean;
  /** Any row is selected — "selection mode" is active. Forces checkbox visible. */
  hasSelection?: boolean;
  /** Toggles `doc.id` membership in the parent's selected set. */
  onToggleSelect?: (e?: React.MouseEvent | React.KeyboardEvent) => void;
}

const LONG_PRESS_MS = 450;

/**
 * Cached once: the same device doesn't switch between touch and hover at
 * runtime, so a per-click `matchMedia` query in N row handlers is waste.
 * Lazy so SSR can call into this module without a `window` reference.
 */
let cachedIsTouchOnly: boolean | null = null;
function isTouchOnlyDevice(): boolean {
  if (cachedIsTouchOnly !== null) return cachedIsTouchOnly;
  if (typeof window === "undefined") return false;
  cachedIsTouchOnly = window.matchMedia("(hover: none)").matches;
  return cachedIsTouchOnly;
}

/**
 * Single document row. The card body is the open-details trigger; the
 * Download / More buttons stop propagation so they don't also open the
 * sheet. Description (when present) renders as a one-line muted preview
 * beneath the filename.
 */
function DocumentRowInner({
  doc,
  sections,
  onOpen,
  onEdit,
  onMove,
  onDownload,
  onDelete,
  onUploadNewVersion,
  canEdit,
  showSectionBadge,
  searchQuery = "",
  isSelected = false,
  hasSelection = false,
  onToggleSelect,
}: DocumentRowProps) {
  const otherSections = sections.filter((s) => s.id !== doc.section_id);
  const selectable = canEdit && !!onToggleSelect;
  const sectionsById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );
  const section = sectionsById.get(doc.section_id);
  const fullPath = section ? sectionFullPath(section, sectionsById) : null;
  // Mobile long-press → enter selection mode. Refs (not state) so the timer
  // and "fired" flag don't trigger re-renders. The flag survives until the
  // synthetic click after touchend so we can swallow the would-be open.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    if (!selectable || hasSelection) return;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(15);
      }
      onToggleSelect?.();
    }, LONG_PRESS_MS);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onTouchStart={startLongPress}
      onTouchMove={clearLongPress}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      onContextMenu={(e) => {
        // Suppress the native long-press context menu on mobile while still
        // letting desktop right-click work normally elsewhere.
        if (selectable && longPressFired.current) e.preventDefault();
      }}
      onClick={(e) => {
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        if (hasSelection && onToggleSelect) onToggleSelect(e);
        else onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (hasSelection && onToggleSelect) onToggleSelect(e);
          else onOpen();
        }
      }}
      className={cn(
        // `select-none` + `touch-manipulation` together kill the iOS / Android
        // text-magnifier that otherwise pops on the long-press gesture used
        // to enter selection mode.
        "group flex items-center gap-3 md:gap-3.5 px-3 md:px-4 py-3 md:py-3.5 bg-bg-primary border rounded-[10px] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent select-none touch-manipulation",
        isSelected
          ? "border-accent/60 bg-accent/[0.06] hover:bg-accent/[0.1]"
          : "border-border-default hover:bg-bg-elevated/50"
      )}
    >
      {/* Icon-as-checkbox swap — mirrors the design-files FileRow pattern.
          Idle: file-icon visible. Hover (selectable & not in selection
          mode): icon dims out, checkbox fades in. `hasSelection` anywhere:
          checkbox stays permanent on every row. */}
      <div
        className="relative w-9 h-9 shrink-0"
        onClick={
          selectable
            ? (e) => {
                e.stopPropagation();
                // On touch devices the icon-as-checkbox affordance isn't
                // visible (no hover) — selection mode is entered via
                // long-press only. Once active, the icon can be tapped to
                // toggle, just like desktop.
                if (isTouchOnlyDevice() && !hasSelection) return;
                onToggleSelect?.(e);
              }
            : undefined
        }
      >
        <div
          className={cn(
            "absolute inset-1 rounded-lg bg-error/10 flex items-center justify-center transition-opacity",
            selectable && hasSelection
              ? "opacity-0"
              : selectable
                ? "opacity-100 group-hover:opacity-0"
                : "opacity-100"
          )}
        >
          <FileText className="w-[18px] h-[18px] text-error" />
        </div>
        {selectable && (
          <div
            role="checkbox"
            aria-checked={isSelected}
            aria-label={
              isSelected
                ? `Deselect ${doc.file_name}`
                : `Select ${doc.file_name}`
            }
            tabIndex={-1}
            className={cn(
              "absolute inset-2 rounded-[4px] flex items-center justify-center transition-opacity",
              isSelected
                ? "bg-accent opacity-100"
                : hasSelection
                  ? "border-[1.5px] border-text-muted opacity-100"
                  : "border-[1.5px] border-text-muted opacity-0 group-hover:opacity-100"
            )}
          >
            {isSelected && (
              <Check className="w-3 h-3 text-black" strokeWidth={3} />
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            <HighlightedText text={doc.file_name} query={searchQuery} />
          </p>
          {showSectionBadge && doc.section_name && (
            <span
              title={fullPath ?? doc.section_name}
              className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-bg-elevated text-[10px] font-medium text-text-secondary"
            >
              {doc.section_name}
            </span>
          )}
        </div>
        {doc.description && (
          <p className="text-xs text-text-secondary line-clamp-1">
            <HighlightedText text={doc.description} query={searchQuery} />
          </p>
        )}
        <div className="flex items-center gap-x-2 gap-y-0.5 text-xs text-text-muted flex-wrap">
          <span className="font-semibold text-[11px]">
            {getFileExtension(doc.file_name).toUpperCase()}
          </span>
          {/* Uploader name is the longest meta segment — hide on mobile to
              keep the row to two visible details (time + size). */}
          <span className="hidden md:inline text-text-muted/60">·</span>
          <span className="hidden md:inline truncate max-w-[160px] lg:max-w-none">
            {doc.uploaded_by_name ?? "Unknown"}
          </span>
          <span className="text-text-muted/60">·</span>
          <span>{relativeTime(doc.created_at)}</span>
          <span className="text-text-muted/60">·</span>
          <span>{formatFileSize(doc.file_size)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onDownload();
        }}
        className={cn(
          "p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors cursor-pointer",
          // When the kebab is rendered (canEdit), hide the standalone
          // Download below md — kebab hosts a Download item on mobile.
          canEdit && "hidden md:inline-flex"
        )}
        aria-label="Download"
      >
        <Download className="w-4 h-4" />
      </button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors data-[state=open]:bg-bg-elevated data-[state=open]:text-text-primary cursor-pointer"
              aria-label="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem
              className="md:hidden"
              onSelect={() => void onDownload()}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit()}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onUploadNewVersion()}>
              <Upload className="w-3.5 h-3.5" />
              Upload new version
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={otherSections.length === 0}>
                <FolderInput className="w-3.5 h-3.5" />
                Move to section
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[200px] max-h-[260px] overflow-y-auto">
                {otherSections.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-text-muted italic">
                    No other sections.
                  </div>
                ) : (
                  otherSections.map((s) => (
                    <DropdownMenuItem key={s.id} onSelect={() => onMove(s.id)}>
                      <SectionIcon
                        icon={s.icon}
                        className="w-3.5 h-3.5 text-text-secondary"
                      />
                      <span className="truncate">{s.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem destructive onSelect={() => void onDelete()}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * Memoized with a custom comparator that **ignores callback identity** —
 * the parent inevitably re-creates `onOpen` / `onMove` / etc. as new
 * closures per render (each binds the current row's `doc`), so default
 * shallow equality would always fail. Comparing only the data props means
 * a single selection toggle re-renders just the affected row, not all N.
 *
 * Stale-closure risk: callbacks the row holds reference the previous
 * render's `doc` until a data prop changes. Safe in practice because the
 * data props (`doc`, `isSelected`, `searchQuery`, …) cover every scenario
 * where the row would consume a callback against fresh state.
 */
export const DocumentRow = memo(DocumentRowInner, (prev, next) => {
  return (
    prev.doc === next.doc &&
    prev.sections === next.sections &&
    prev.canEdit === next.canEdit &&
    prev.showSectionBadge === next.showSectionBadge &&
    prev.searchQuery === next.searchQuery &&
    prev.isSelected === next.isSelected &&
    prev.hasSelection === next.hasSelection
  );
});
