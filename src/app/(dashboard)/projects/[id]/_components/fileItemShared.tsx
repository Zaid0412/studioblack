import { Lock } from "lucide-react";
import type { FileContextMenuProps } from "@/components/ui/FileContextMenu";
import type { DbAttachment } from "@/types";

/** Shared props for both FileRow (desktop) and FileCard (mobile). */
export interface FileItemBaseProps extends FileContextMenuProps {
  att: DbAttachment;
  isSelected: boolean;
  hasSelection: boolean;
  isStaff: boolean;
  isNewForClient: boolean;
  badge: { bg: string; text: string; label: string };
  onToggleSelect: (e: React.MouseEvent) => void;
  /** Override to required. */
  onDownload: () => void;
  frozen: boolean;
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
      {att.frozen_at && <Lock className="w-3 h-3 text-accent shrink-0" />}
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
