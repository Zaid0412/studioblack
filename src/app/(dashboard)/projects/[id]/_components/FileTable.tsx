"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, FileText, Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileContextMenu } from "@/components/ui/FileContextMenu";
import { UploadDialog } from "@/components/ui/UploadDialog";
import { VersionHistoryDialog } from "./VersionHistoryDialog";
import { deriveInitials } from "@/lib/utils";
import { fileType, statusBadge, versionColor } from "@/lib/fileUtils";
import { attachments as attachmentsApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { avatarColor } from "@/lib/avatarUtils";
import type { DbAttachment } from "@/types";

interface FileTableProps {
  projectId: string;
  activePhaseId: string | null;
  phaseFiles: DbAttachment[];
  onDownload: (att: DbAttachment) => void;
  onRefresh: () => void;
  /** Exposed so parent can trigger upload dialog from elsewhere (e.g. WorkflowBar). */
  uploadTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

/** Table of phase attachments with type, size, and download/review actions. */
export function FileTable({
  projectId,
  activePhaseId,
  phaseFiles,
  onDownload,
  onRefresh,
  uploadTriggerRef,
}: FileTableProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const te = useTranslations("emptyStates");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVersionGroup, setUploadVersionGroup] = useState<string | null>(
    null
  );
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [versionHistoryGroup, setVersionHistoryGroup] = useState<string | null>(
    null
  );

  const openUpload = useCallback(
    (versionGroup?: string | null, files?: File[]) => {
      setUploadVersionGroup(versionGroup || null);
      setDroppedFiles(files || []);
      setUploadOpen(true);
    },
    []
  );

  // Expose openUpload to parent via ref
  useEffect(() => {
    if (uploadTriggerRef) uploadTriggerRef.current = () => openUpload();
    return () => {
      if (uploadTriggerRef) uploadTriggerRef.current = null;
    };
  }, [uploadTriggerRef, openUpload]);

  const handleTableDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleTableDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleTableDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        openUpload(null, Array.from(e.dataTransfer.files));
      }
    },
    [openUpload]
  );

  const handleToggleFreeze = useCallback(
    async (att: DbAttachment) => {
      try {
        if (att.frozen_at) {
          await attachmentsApi.unfreeze(projectId, att.id);
          toast({
            title: "File unfrozen",
            description: `"${att.file_name}" can now be edited.`,
            variant: "success",
          });
        } else {
          await attachmentsApi.freeze(projectId, att.id);
          toast({
            title: "File frozen",
            description: `"${att.file_name}" is now locked.`,
            variant: "success",
          });
        }
        onRefresh();
      } catch {
        toast({
          title: "Error",
          description: "Failed to update freeze status.",
          variant: "error",
        });
      }
    },
    [projectId, onRefresh]
  );

  const handleUploadSuccess = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="flex-1 px-10 py-4">
      <div
        className={`rounded-[10px] bg-[#1A1A1A] border overflow-hidden flex flex-col min-h-[400px] transition-colors ${
          dragOver ? "border-[#F5C518] bg-[#F5C518]/5" : "border-[#333333]"
        }`}
        onDragOver={handleTableDragOver}
        onDragLeave={handleTableDragLeave}
        onDrop={handleTableDrop}
      >
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
          {dragOver ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <Upload className="w-8 h-8 text-[#F5C518]" />
              <p className="text-sm font-medium text-[#F5C518]">
                Drop files to upload
              </p>
            </div>
          ) : phaseFiles.length === 0 ? (
            <EmptyState
              icon={Upload}
              title={te("designSectionsTitle")}
              description={te("designSectionsDescription")}
              action={{
                label: te("designSectionsAction"),
                onClick: () => openUpload(),
              }}
            />
          ) : (
            phaseFiles.map((att) => {
              const badge = statusBadge(att.review_status);
              const color = avatarColor(att.uploaded_by || "");
              const vc = versionColor(att.version || 1);
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
                    <div className="relative shrink-0">
                      <FileText className="w-4 h-4 text-[#A0A0A0]" />
                      <span
                        className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none`}
                      >
                        V{att.version || 1}
                      </span>
                    </div>
                    {att.frozen_at && (
                      <Lock className="w-3 h-3 text-[#F5C518] shrink-0" />
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
                      onUploadNewVersion={() => openUpload(att.version_group)}
                      onVersionHistory={
                        att.version_group
                          ? () => setVersionHistoryGroup(att.version_group!)
                          : undefined
                      }
                      onViewReview={
                        att.review_status && att.review_status !== "pending"
                          ? () =>
                              router.push(
                                `/projects/${projectId}/review/${att.id}?reviews=open`
                              )
                          : undefined
                      }
                      frozen={!!att.frozen_at}
                      onToggleFreeze={() => handleToggleFreeze(att)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        phaseId={activePhaseId}
        versionGroup={uploadVersionGroup}
        initialFiles={droppedFiles}
        onSuccess={handleUploadSuccess}
      />

      {versionHistoryGroup && (
        <VersionHistoryDialog
          open={!!versionHistoryGroup}
          onOpenChange={(open) => {
            if (!open) setVersionHistoryGroup(null);
          }}
          projectId={projectId}
          versionGroup={versionHistoryGroup}
        />
      )}
    </div>
  );
}
