"use client";

import { FileText, Download, MoreHorizontal, Trash2 } from "lucide-react";
import type { DbProjectDocument } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { formatFileSize, getFileExtension } from "@/lib/fileUtils";
import { relativeTime } from "@/lib/formatTime";

interface DocumentRowProps {
  doc: DbProjectDocument;
  onDownload: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  canEdit: boolean;
  /** When true, render the doc's section name as a small badge. Used in All view. */
  showSectionBadge?: boolean;
}

/** Single document row: file icon, name + meta, download button, more-menu. */
export function DocumentRow({
  doc,
  onDownload,
  onDelete,
  canEdit,
  showSectionBadge,
}: DocumentRowProps) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 bg-bg-primary border border-border-default rounded-[10px]">
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
        onClick={onDownload}
        className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors"
        aria-label="Download"
      >
        <Download className="w-4 h-4" />
      </button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors data-[state=open]:bg-bg-elevated data-[state=open]:text-text-primary"
              aria-label="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
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
