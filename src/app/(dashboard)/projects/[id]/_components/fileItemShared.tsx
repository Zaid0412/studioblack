"use client";

import { Lock } from "lucide-react";
import type { FileContextMenuProps } from "@/components/ui/FileContextMenu";
import type { DbAttachment } from "@/types";
import { useFlag } from "@/hooks/useFlag";
import { DRAWING_TYPE_LABELS } from "@/lib/designTemplates";

/** Shared props for both FileRow (desktop) and FileCard (mobile). */
export interface FileItemBaseProps {
  att: DbAttachment;
  isSelected: boolean;
  hasSelection: boolean;
  isStaff: boolean;
  isNewForClient: boolean;
  badge: { bg: string; text: string; label: string };
  onToggleSelect: (e: React.MouseEvent) => void;
  contextMenuProps: FileContextMenuProps & {
    onDownload: () => void;
    frozen: boolean;
  };
}

/** Shared frozen / sent-to-client / new-for-client indicator badges. */
export function FileStatusIndicators({
  att,
  isStaff,
  isNewForClient,
}: {
  att: DbAttachment;
  isStaff: boolean;
  isNewForClient: boolean;
}) {
  return (
    <>
      {att.frozen_at && (
        <Lock className="w-3 h-3 text-accent-strong shrink-0" />
      )}
      {isNewForClient && (
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
      )}
      {isStaff && att.sent_to_client_at && (
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-500 text-[9px] font-medium px-1.5 py-0.5 shrink-0">
          Sent
        </span>
      )}
    </>
  );
}

/**
 * Dim sub-line under the filename: `<document number> · <discipline> · <type>`.
 * Renders nothing when Document Control is off, or for unclassified/legacy
 * files (no document number).
 */
export function DrawingMeta({ att }: { att: DbAttachment }) {
  const docControl = useFlag("designDocumentControl");
  if (!docControl || !att.document_number) return null;
  const parts = [
    att.discipline_name,
    att.drawing_type
      ? (DRAWING_TYPE_LABELS[att.drawing_type] ?? att.drawing_type)
      : null,
  ].filter(Boolean);
  return (
    <span className="block text-[10px] leading-tight text-text-muted truncate">
      <span className="font-mono">{att.document_number}</span>
      {parts.length > 0 && ` · ${parts.join(" · ")}`}
    </span>
  );
}
