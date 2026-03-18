"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileContextMenu } from "@/components/ui/FileContextMenu";
import { deriveInitials } from "@/lib/utils";
import { fileType, statusBadge } from "@/lib/fileUtils";
import { avatarColor } from "@/lib/avatarUtils";
import type { DbAttachment } from "@/types";

interface FileTableProps {
  projectId: string;
  activePhaseId: string | null;
  phaseFiles: DbAttachment[];
  onDownload: (att: DbAttachment) => void;
}

/** Table of phase attachments with type, size, and download/review actions. */
export function FileTable({
  projectId,
  activePhaseId,
  phaseFiles,
  onDownload,
}: FileTableProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const te = useTranslations("emptyStates");

  return (
    <div className="flex-1 px-10 py-4">
      <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-[400px]">
        {/* Table header */}
        <div className="flex items-center h-11 px-5 bg-[#242424] border-b border-[#333333]">
          <div className="flex-1 text-xs font-medium text-[#A0A0A0]">
            {t("fileName") || "Name of File"}
          </div>
          <div className="w-[120px] text-xs font-medium text-[#A0A0A0]">
            {t("fileType") || "Type of File"}
          </div>
          <div className="w-[140px] text-xs font-medium text-[#A0A0A0]">
            {t("uploadedBy") || "Uploaded by"}
          </div>
          <div className="w-[110px] text-xs font-medium text-[#A0A0A0]">
            {t("uploadedOn") || "Uploaded On"}
          </div>
          <div className="w-[140px] text-xs font-medium text-[#A0A0A0]">
            {t("statusLabel").replace(":", "") || "Status"}
          </div>
          <div className="w-[50px]" />
        </div>

        {/* Table body */}
        <div className="flex-1">
          {phaseFiles.length === 0 ? (
            <EmptyState
              icon={Upload}
              title={te("designSectionsTitle")}
              description={te("designSectionsDescription")}
              action={{
                label: te("designSectionsAction"),
                href: `/projects/${projectId}/upload${activePhaseId ? `?phaseId=${activePhaseId}` : ""}`,
              }}
            />
          ) : (
            phaseFiles.map((att) => {
              const badge = statusBadge(att.review_status);
              const color = avatarColor(att.uploaded_by || "");
              return (
                <div
                  key={att.id}
                  className="flex items-center h-[52px] px-5 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() =>
                    router.push(`/projects/${projectId}/review/${att.id}`)
                  }
                >
                  {/* File name */}
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-[#A0A0A0] shrink-0" />
                    {att.version && att.version > 1 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-[#2A1F00] px-1.5 py-0.5 text-[10px] font-medium text-[#F5C518]">
                        V{att.version}
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-white truncate">
                      {att.file_name}
                    </span>
                  </div>

                  {/* Type */}
                  <div className="w-[120px]">
                    <span className="text-[13px] text-[#A0A0A0]">
                      {fileType(att.file_name)}
                    </span>
                  </div>

                  {/* Uploaded by */}
                  <div className="w-[140px] flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {deriveInitials(att.uploaded_by_name || "")}
                    </div>
                    <span className="text-[13px] text-[#A0A0A0] truncate">
                      {att.uploaded_by_name || "\u2014"}
                    </span>
                  </div>

                  {/* Uploaded on */}
                  <div className="w-[110px]">
                    <span className="text-[12px] text-[#666666]">
                      {new Date(att.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-[140px]">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div
                    className="w-[50px] flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileContextMenu
                      onDownload={() => onDownload(att)}
                      onEdit={() =>
                        router.push(`/projects/${projectId}/review/${att.id}`)
                      }
                      onUploadNewVersion={() =>
                        router.push(
                          `/projects/${projectId}/upload?phaseId=${att.phase_id}&versionGroup=${att.version_group}`
                        )
                      }
                      onViewReview={
                        att.review_status && att.review_status !== "pending"
                          ? () =>
                              router.push(
                                `/projects/${projectId}/review/${att.id}?reviews=open`
                              )
                          : undefined
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
