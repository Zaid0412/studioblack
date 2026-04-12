"use client";

import { FileText, Lock, Check } from "lucide-react";
import { FileContextMenu } from "@/components/ui/FileContextMenu";
import { fileType, versionColor } from "@/lib/fileUtils";
import { formatShortDate } from "@/lib/formatDate";
import type { DbAttachment } from "@/types";

interface FileCardProps {
  att: DbAttachment;
  isSelected: boolean;
  hasSelection: boolean;
  isStaff: boolean;
  isNewForClient: boolean;
  badge: { bg: string; text: string; label: string };
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onClick: (e: React.MouseEvent) => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onDownload: () => void;
  onEdit?: () => void;
  onUploadNewVersion?: () => void;
  onVersionHistory?: () => void;
  onViewReview?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onMarkReviewed?: () => void;
  onSendToClient?: () => void;
  frozen: boolean;
  onToggleFreeze?: () => void;
  onRemove?: () => void;
}

/** Mobile card view for a single file attachment. */
export function FileCard({
  att,
  isSelected,
  hasSelection,
  isStaff,
  isNewForClient,
  badge,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onClick,
  onToggleSelect,
  onDownload,
  onEdit,
  onUploadNewVersion,
  onVersionHistory,
  onViewReview,
  onApprove,
  onReject,
  onMarkReviewed,
  onSendToClient,
  frozen,
  onToggleFreeze,
  onRemove,
}: FileCardProps) {
  const vc = versionColor(att.version || 1);

  return (
    <div
      className={`flex flex-col gap-2 p-4 border-b border-border-default last:border-b-0 active:bg-bg-elevated/50 transition-colors cursor-pointer lg:hidden border-l-2 ${
        isSelected
          ? "bg-accent/[0.06] border-l-transparent"
          : isNewForClient
            ? "bg-blue-500/[0.04] border-l-blue-500"
            : "border-l-transparent"
      }`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div
          className="relative shrink-0 w-4 h-4"
          onClick={(e) => {
            if (hasSelection) {
              onToggleSelect(e);
            }
          }}
        >
          {hasSelection ? (
            isSelected ? (
              <div className="w-4 h-4 rounded-[3px] bg-accent flex items-center justify-center">
                <Check className="w-3 h-3 text-black" strokeWidth={3} />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-[3px] border border-text-muted" />
            )
          ) : (
            <FileText className="w-4 h-4 text-text-secondary" />
          )}
          {!hasSelection && (
            <span
              className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} ${vc.border} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none`}
            >
              V{att.version || 1}
            </span>
          )}
        </div>
        {att.frozen_at && <Lock className="w-3 h-3 text-accent shrink-0" />}
        {isNewForClient && (
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        )}
        {isStaff && att.sent_to_client_at && (
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-500 text-[9px] font-medium px-1.5 py-0.5 shrink-0">
            Sent
          </span>
        )}
        <span
          className={`text-[13px] font-medium truncate flex-1 ${isNewForClient ? "text-text-primary font-semibold" : "text-text-primary"}`}
        >
          {att.file_name}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text} shrink-0`}
        >
          {badge.label}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <FileContextMenu
            onDownload={onDownload}
            onEdit={onEdit}
            onUploadNewVersion={onUploadNewVersion}
            onVersionHistory={onVersionHistory}
            onViewReview={onViewReview}
            onApprove={onApprove}
            onReject={onReject}
            onMarkReviewed={onMarkReviewed}
            onSendToClient={onSendToClient}
            frozen={frozen}
            onToggleFreeze={onToggleFreeze}
            onRemove={onRemove}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>{fileType(att.file_name)}</span>
        <span>{formatShortDate(att.created_at)}</span>
        {att.uploaded_by_name && (
          <span className="ml-auto text-text-secondary truncate">
            {att.uploaded_by_name}
          </span>
        )}
      </div>
    </div>
  );
}
