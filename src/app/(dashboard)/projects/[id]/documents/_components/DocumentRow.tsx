"use client";

import {
  FileText,
  Download,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { SectionIcon } from "./SectionIcon";

interface DocumentRowProps {
  doc: DbProjectDocument;
  sections: DbProjectDocumentSection[];
  onOpen: () => void;
  onEdit: () => void;
  onMove: (sectionId: string) => void;
  onDownload: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  canEdit: boolean;
  /** When true, render the doc's section name as a small badge. Used in All view. */
  showSectionBadge?: boolean;
}

/**
 * Single document row. The card body is the open-details trigger; the
 * Download / More buttons stop propagation so they don't also open the
 * sheet. Description (when present) renders as a one-line muted preview
 * beneath the filename.
 */
export function DocumentRow({
  doc,
  sections,
  onOpen,
  onEdit,
  onMove,
  onDownload,
  onDelete,
  canEdit,
  showSectionBadge,
}: DocumentRowProps) {
  const otherSections = sections.filter((s) => s.id !== doc.section_id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex items-center gap-3.5 px-4 py-3.5 bg-bg-primary border border-border-default rounded-[10px] hover:bg-bg-elevated/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="p-2 bg-error/10 rounded-lg shrink-0">
        <FileText className="w-[18px] h-[18px] text-error" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {doc.file_name}
          </p>
          {showSectionBadge && doc.section_name && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-bg-elevated text-[10px] font-medium text-text-secondary">
              {doc.section_name}
            </span>
          )}
        </div>
        {doc.description && (
          <p className="text-xs text-text-secondary line-clamp-1">
            {doc.description}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-text-muted truncate">
          <span className="font-semibold text-[11px]">
            {getFileExtension(doc.file_name).toUpperCase()}
          </span>
          <span className="text-text-muted/60">·</span>
          <span className="truncate">{doc.uploaded_by_name ?? "Unknown"}</span>
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
        className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors cursor-pointer"
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
            <DropdownMenuItem onSelect={() => onEdit()}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
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
