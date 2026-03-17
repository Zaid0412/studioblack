"use client";

import {
  CheckCircle,
  Download,
  Eye,
  History,
  MoreVertical,
  Pencil,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";

interface FileContextMenuProps {
  onEdit?: () => void;
  onRemove?: () => void;
  onDownload?: () => void;
  onUploadNewVersion?: () => void;
  onVersionHistory?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onMarkReviewed?: () => void;
  showReviewActions?: boolean;
}

/**
 *
 */
export function FileContextMenu({
  onEdit,
  onRemove,
  onDownload,
  onUploadNewVersion,
  onVersionHistory,
  onApprove,
  onReject,
  onMarkReviewed,
  showReviewActions = false,
}: FileContextMenuProps) {
  const hasTopItems = onEdit || onDownload || onUploadNewVersion;
  const hasReviewItems =
    showReviewActions && (onApprove || onReject || onMarkReviewed);

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
        {(hasTopItems || onVersionHistory) && hasReviewItems && (
          <DropdownMenuSeparator />
        )}
        {showReviewActions && onApprove && (
          <DropdownMenuItem onSelect={onApprove}>
            <CheckCircle />
            Approve
          </DropdownMenuItem>
        )}
        {showReviewActions && onReject && (
          <DropdownMenuItem onSelect={onReject}>
            <XCircle />
            Reject
          </DropdownMenuItem>
        )}
        {showReviewActions && onMarkReviewed && (
          <DropdownMenuItem onSelect={onMarkReviewed}>
            <Eye />
            Mark Reviewed
          </DropdownMenuItem>
        )}
        {(hasTopItems || onVersionHistory || hasReviewItems) && onRemove && (
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
