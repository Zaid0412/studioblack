"use client";

import { FileText, Check } from "lucide-react";
import { FileContextMenu } from "@/components/ui/FileContextMenu";
import { deriveInitials } from "@/lib/utils";
import { fileType, versionColor } from "@/lib/fileUtils";
import { avatarColor } from "@/lib/avatarUtils";
import { formatDate } from "@/lib/formatDate";
import { FileItemBaseProps, FileStatusIndicators } from "./fileItemShared";

interface FileRowProps extends FileItemBaseProps {
  onRowClick: (e: React.MouseEvent) => void;
}

/** Desktop table row for a single file attachment. */
export function FileRow({
  att,
  isSelected,
  hasSelection,
  isStaff,
  isNewForClient,
  badge,
  onRowClick,
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
}: FileRowProps) {
  const color = avatarColor(att.uploaded_by || "");
  const vc = versionColor(att.version || 1);

  return (
    <div
      className={`group hidden lg:flex items-center h-[52px] px-5 border-b border-border-default last:border-b-0 transition-colors cursor-pointer border-l-2 ${
        isSelected
          ? "bg-accent/[0.06] border-l-transparent"
          : isNewForClient
            ? "bg-blue-500/[0.04] hover:bg-blue-500/[0.08] border-l-blue-500"
            : "hover:bg-bg-elevated/50 border-l-transparent"
      }`}
      onClick={onRowClick}
    >
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        <div
          className="relative shrink-0 w-4 h-4 cursor-pointer"
          onClick={(e) => {
            if (!hasSelection) onToggleSelect(e);
          }}
        >
          {/* File icon — hidden on hover (when no selection) or when selected */}
          <FileText
            className={`w-4 h-4 text-text-secondary absolute inset-0 transition-opacity ${
              hasSelection ? "opacity-0" : "opacity-100 group-hover:opacity-0"
            }`}
          />
          {/* Checkbox — shown on hover or when in selection mode */}
          {isSelected ? (
            <div
              role="checkbox"
              aria-checked={true}
              aria-label={`Deselect ${att.file_name}`}
              tabIndex={0}
              className="absolute inset-0 flex items-center justify-center w-4 h-4 rounded-[3px] bg-accent"
              onClick={onToggleSelect}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onToggleSelect(e as unknown as React.MouseEvent);
                }
              }}
            >
              <Check className="w-3 h-3 text-black" strokeWidth={3} />
            </div>
          ) : (
            <div
              role="checkbox"
              aria-checked={false}
              aria-label={`Select ${att.file_name}`}
              tabIndex={0}
              className={`absolute inset-0 w-4 h-4 rounded-[3px] border border-text-muted transition-opacity ${
                hasSelection
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={onToggleSelect}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onToggleSelect(e as unknown as React.MouseEvent);
                }
              }}
            />
          )}
          {/* Version badge — hidden when checkbox is showing */}
          <span
            className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} ${vc.border} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none transition-opacity ${
              hasSelection ? "opacity-0" : "opacity-100 group-hover:opacity-0"
            }`}
          >
            V{att.version || 1}
          </span>
        </div>
        <FileStatusIndicators
          att={att}
          isStaff={isStaff}
          isNewForClient={isNewForClient}
        />
        <span
          className={`text-[13px] font-medium truncate ${isNewForClient ? "text-text-primary font-semibold" : "text-text-primary"}`}
        >
          {att.file_name}
        </span>
      </div>
      <div className="w-[120px]">
        <span className="text-[13px] text-text-secondary">
          {fileType(att.file_name)}
        </span>
      </div>
      <div className="w-[140px] flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {deriveInitials(att.uploaded_by_name || "")}
        </div>
        <span className="text-[13px] text-text-secondary truncate">
          {att.uploaded_by_name || "\u2014"}
        </span>
      </div>
      <div className="w-[110px]">
        <span className="text-[12px] text-text-muted">
          {formatDate(att.created_at)}
        </span>
      </div>
      <div className="w-[140px]">
        <span
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="w-[50px] flex items-center justify-center">
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
    </div>
  );
}
