"use client";

import {
  ClipboardCheck,
  Download,
  History,
  MoreVertical,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface FileContextMenuProps {
  onEdit?: () => void;
  onRemove?: () => void;
  onDownload?: () => void;
  onUploadNewVersion?: () => void;
  onVersionHistory?: () => void;
  onViewReview?: () => void;
}

/** Context menu for file actions: edit, remove, download, version history, and review. */
export function FileContextMenu({
  onEdit,
  onRemove,
  onDownload,
  onUploadNewVersion,
  onVersionHistory,
  onViewReview,
}: FileContextMenuProps) {
  const hasTopItems = onEdit || onDownload || onUploadNewVersion;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={16} color="#666666" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
        )}
        {onDownload && (
          <DropdownMenuItem onSelect={onDownload}>
            <Download />
            Download
          </DropdownMenuItem>
        )}
        {onUploadNewVersion && (
          <DropdownMenuItem onSelect={onUploadNewVersion}>
            <Upload />
            Upload New Version
          </DropdownMenuItem>
        )}
        {hasTopItems && onVersionHistory && <DropdownMenuSeparator />}
        {onVersionHistory && (
          <DropdownMenuItem onSelect={onVersionHistory}>
            <History />
            Version History
          </DropdownMenuItem>
        )}
        {onViewReview && (
          <DropdownMenuItem onSelect={onViewReview}>
            <ClipboardCheck />
            View Review
          </DropdownMenuItem>
        )}
        {(hasTopItems || onVersionHistory || onViewReview) && onRemove && (
          <DropdownMenuSeparator />
        )}
        {onRemove && (
          <DropdownMenuItem destructive onSelect={onRemove}>
            <Trash2 />
            Remove
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
