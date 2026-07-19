"use client";

import {
  Check,
  ClipboardCheck,
  Download,
  History,
  Lock,
  MoreVertical,
  Pencil,
  Send,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

export interface FileContextMenuProps {
  onEdit?: () => void;
  onRemove?: () => void;
  onDownload?: () => void;
  onUploadNewVersion?: () => void;
  onVersionHistory?: () => void;
  onViewReview?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onMarkReviewed?: () => void;
  onSendToClient?: () => void;
  frozen?: boolean;
  onToggleFreeze?: () => void;
}

/** Context menu for file actions: edit, remove, download, version history, and review. */
export function FileContextMenu({
  onEdit,
  onRemove,
  onDownload,
  onUploadNewVersion,
  onVersionHistory,
  onViewReview,
  onApprove,
  onReject,
  onMarkReviewed,
  onSendToClient,
  frozen,
  onToggleFreeze,
}: FileContextMenuProps) {
  const hasTopItems = onEdit || onDownload || onUploadNewVersion;
  const hasReviewActions = onApprove || onReject || onMarkReviewed;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={16} color="var(--text-muted)" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && !frozen && (
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
        {onUploadNewVersion && !frozen && (
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
        {hasReviewActions && <DropdownMenuSeparator />}
        {onApprove && (
          <DropdownMenuItem accent onSelect={onApprove}>
            <Check />
            Approve
          </DropdownMenuItem>
        )}
        {onReject && (
          <DropdownMenuItem destructive onSelect={onReject}>
            <X />
            Reject
          </DropdownMenuItem>
        )}
        {onMarkReviewed && (
          <DropdownMenuItem accent onSelect={onMarkReviewed}>
            <ClipboardCheck />
            Mark Reviewed
          </DropdownMenuItem>
        )}
        {onSendToClient && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem accent onSelect={onSendToClient}>
              <Send />
              Send to Client
            </DropdownMenuItem>
          </>
        )}
        {onToggleFreeze && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleFreeze}>
              {frozen ? <Unlock /> : <Lock />}
              {frozen ? "Unfreeze Design" : "Freeze Design"}
            </DropdownMenuItem>
          </>
        )}
        {(hasTopItems ||
          onVersionHistory ||
          onViewReview ||
          hasReviewActions) &&
          onRemove &&
          !frozen && <DropdownMenuSeparator />}
        {onRemove && !frozen && (
          <DropdownMenuItem destructive onSelect={onRemove}>
            <Trash2 />
            Remove
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
