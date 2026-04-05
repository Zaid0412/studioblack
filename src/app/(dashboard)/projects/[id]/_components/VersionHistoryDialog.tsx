"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { attachments } from "@/lib/api";
import { statusBadge, versionColor } from "@/lib/fileUtils";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import type { DbAttachment } from "@/types";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  versionGroup: string;
}

/** Display version history for a file group in a modal dialog. */
export function VersionHistoryDialog({
  open,
  onOpenChange,
  projectId,
  versionGroup,
}: VersionHistoryDialogProps) {
  const router = useRouter();

  type State = { loading: boolean; versions: DbAttachment[] };
  type Action =
    | { type: "fetch" }
    | { type: "fetched"; versions: DbAttachment[] }
    | { type: "error" };
  const [{ loading, versions }, dispatch] = useReducer(
    (_: State, action: Action): State => {
      if (action.type === "fetch") return { loading: true, versions: [] };
      if (action.type === "fetched")
        return { loading: false, versions: action.versions };
      return { loading: false, versions: [] };
    },
    { loading: true, versions: [] }
  );

  useEffect(() => {
    if (!open) return;
    dispatch({ type: "fetch" });
    let cancelled = false;
    attachments
      .getVersionHistory(projectId, versionGroup)
      .then((data) => {
        if (!cancelled) dispatch({ type: "fetched", versions: data });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, versionGroup]);

  const latestName = versions[0]?.file_name || "File";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Version History</DialogTitle>
          <p className="text-sm text-text-secondary truncate">{latestName}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#F5C518]" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">
              No versions found.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((v, i) => {
                const badge = statusBadge(v.review_status);
                const color = avatarColor(v.uploaded_by || "");
                const vc = versionColor(v.version || 1);
                const isCurrent = i === 0;

                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer hover:bg-bg-elevated/50 ${
                      isCurrent
                        ? "border-[#F5C518]/30 bg-[#F5C518]/5"
                        : "border-border-default bg-bg-secondary"
                    }`}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/projects/${projectId}/review/${v.id}`);
                    }}
                  >
                    {/* Version badge + icon */}
                    <div className="relative shrink-0">
                      <FileText className="w-5 h-5 text-text-secondary" />
                      <span
                        className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none`}
                      >
                        V{v.version || 1}
                      </span>
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {v.file_name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-medium text-[#F5C518] bg-[#2A1F00] px-1.5 py-0.5 rounded-full">
                            Latest
                          </span>
                        )}
                        {v.frozen_at && (
                          <Lock className="w-3 h-3 text-[#F5C518]" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white"
                            style={{ backgroundColor: color }}
                          >
                            {deriveInitials(v.uploaded_by_name || "")}
                          </div>
                          <span className="text-xs text-text-secondary">
                            {v.uploaded_by_name || "—"}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted">
                          {new Date(v.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text} shrink-0`}
                    >
                      {badge.label}
                    </span>

                    {/* Download */}
                    <button
                      className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(v.file_url, "_blank");
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
