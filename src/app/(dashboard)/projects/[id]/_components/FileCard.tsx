"use client";

import { FileText, Check } from "lucide-react";
import { FileContextMenu } from "@/components/ui/FileContextMenu";
import { fileType, versionColor } from "@/lib/fileUtils";
import { formatShortDate } from "@/lib/formatDate";
import {
  FileItemBaseProps,
  FileStatusIndicators,
  DrawingMeta,
} from "./fileItemShared";

interface FileCardProps extends FileItemBaseProps {
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onContextMenu: (e: React.SyntheticEvent) => void;
  onClick: (e: React.MouseEvent) => void;
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
  onContextMenu,
  onClick,
  onToggleSelect,
  contextMenuProps,
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
      onContextMenu={onContextMenu}
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
        <FileStatusIndicators
          att={att}
          isStaff={isStaff}
          isNewForClient={isNewForClient}
        />
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
          <FileContextMenu {...contextMenuProps} />
        </div>
      </div>
      <DrawingMeta att={att} />
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
