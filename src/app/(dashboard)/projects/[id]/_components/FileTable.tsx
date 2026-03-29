"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Upload,
  FileText,
  Lock,
  Check,
  Download,
  X,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
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
  /** When true, disables upload and drag-drop (client view). */
  readOnly?: boolean;
  /** Base path for review navigation. Defaults to "/projects". */
  basePath?: string;
  /** Current user's role — controls which context menu actions appear. */
  userRole?: "pm" | "architect" | "client" | null;
  /** Current user's ID — used to check file ownership for remove action. */
  currentUserId?: string;
}

/** Table of phase attachments with type, size, and download/review actions. */
export function FileTable({
  projectId,
  activePhaseId,
  phaseFiles,
  onDownload,
  onRefresh,
  uploadTriggerRef,
  readOnly = false,
  basePath = "/projects",
  userRole,
  currentUserId,
}: FileTableProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const te = useTranslations("emptyStates");
  const isClient = userRole === "client";
  const isStaff = userRole === "pm" || userRole === "architect";

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVersionGroup, setUploadVersionGroup] = useState<string | null>(
    null
  );
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [versionHistoryGroup, setVersionHistoryGroup] = useState<string | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const hasSelection = selectedIds.size > 0;

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

  const handleRemove = useCallback(
    async (att: DbAttachment) => {
      try {
        await attachmentsApi.remove(projectId, att.id);
        toast({
          title: "File removed",
          description: `"${att.file_name}" has been removed.`,
          variant: "success",
        });
        onRefresh();
      } catch {
        toast({
          title: "Error",
          description: "Failed to remove file.",
          variant: "error",
        });
      }
    },
    [projectId, onRefresh]
  );

  const handleReviewAction = useCallback(
    async (att: DbAttachment, status: "approved" | "rejected") => {
      try {
        await attachmentsApi.submitReview(projectId, att.id, { status });
        toast({
          title: status === "approved" ? "Design approved" : "Design rejected",
          description: `"${att.file_name}" has been ${status}.`,
          variant: "success",
        });
        onRefresh();
      } catch {
        toast({
          title: "Error",
          description: `Failed to ${status === "approved" ? "approve" : "reject"} design.`,
          variant: "error",
        });
      }
    },
    [projectId, onRefresh]
  );

  const handleMarkReviewed = useCallback(
    async (att: DbAttachment) => {
      try {
        await attachmentsApi.markReviewed(projectId, att.id);
        toast({
          title: "Marked as reviewed",
          description: `"${att.file_name}" has been marked as reviewed.`,
          variant: "success",
        });
        onRefresh();
      } catch {
        toast({
          title: "Error",
          description: "Failed to mark as reviewed.",
          variant: "error",
        });
      }
    },
    [projectId, onRefresh]
  );

  const handleUploadSuccess = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedFiles = phaseFiles.filter((f) => selectedIds.has(f.id));

  const handleBulkDownload = useCallback(() => {
    for (const att of selectedFiles) onDownload(att);
    clearSelection();
  }, [selectedFiles, onDownload, clearSelection]);

  const handleBulkReview = useCallback(
    async (status: "approved" | "rejected") => {
      try {
        await Promise.all(
          selectedFiles.map((att) =>
            attachmentsApi.submitReview(projectId, att.id, { status })
          )
        );
        toast({
          title:
            status === "approved" ? "Designs approved" : "Designs rejected",
          description: `${selectedFiles.length} file(s) ${status}.`,
          variant: "success",
        });
        clearSelection();
        onRefresh();
      } catch {
        toast({
          title: "Error",
          description: `Failed to ${status} designs.`,
          variant: "error",
        });
      }
    },
    [selectedFiles, projectId, clearSelection, onRefresh]
  );

  const handleBulkMarkReviewed = useCallback(async () => {
    try {
      await Promise.all(
        selectedFiles.map((att) =>
          attachmentsApi.markReviewed(projectId, att.id)
        )
      );
      toast({
        title: "Marked as reviewed",
        description: `${selectedFiles.length} file(s) marked as reviewed.`,
        variant: "success",
      });
      clearSelection();
      onRefresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark as reviewed.",
        variant: "error",
      });
    }
  }, [selectedFiles, projectId, clearSelection, onRefresh]);

  const handleBulkRemove = useCallback(async () => {
    try {
      await Promise.all(
        selectedFiles.map((att) => attachmentsApi.remove(projectId, att.id))
      );
      toast({
        title: "Files removed",
        description: `${selectedFiles.length} file(s) removed.`,
        variant: "success",
      });
      clearSelection();
      onRefresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove files.",
        variant: "error",
      });
    }
  }, [selectedFiles, projectId, clearSelection, onRefresh]);

  const handleBulkFreeze = useCallback(async () => {
    try {
      await Promise.all(
        selectedFiles
          .filter((att) => !att.frozen_at)
          .map((att) => attachmentsApi.freeze(projectId, att.id))
      );
      toast({
        title: "Designs frozen",
        description: `${selectedFiles.length} file(s) frozen.`,
        variant: "success",
      });
      clearSelection();
      onRefresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to freeze designs.",
        variant: "error",
      });
    }
  }, [selectedFiles, projectId, clearSelection, onRefresh]);

  const reviewPath = (attId: string) =>
    `${basePath}/${projectId}/review/${attId}`;

  return (
    <div className="flex-1 px-4 lg:px-10 py-4">
      <div
        className={`rounded-[10px] bg-bg-secondary border overflow-hidden flex flex-col ${readOnly ? "min-h-[300px]" : "min-h-[400px]"} transition-colors ${
          dragOver && !readOnly
            ? "border-accent bg-[#F5C518]/5"
            : "border-border-default"
        }`}
        onDragOver={readOnly ? undefined : handleTableDragOver}
        onDragLeave={readOnly ? undefined : handleTableDragLeave}
        onDrop={readOnly ? undefined : handleTableDrop}
      >
        {/* Table header / bulk action bar (desktop only) — same slot, no layout shift */}
        <div className="hidden lg:flex items-center h-11 px-5 bg-bg-elevated border-b border-border-default">
          {hasSelection ? (
            <>
              <div
                className="w-4 h-4 rounded-[3px] flex items-center justify-center cursor-pointer shrink-0"
                style={{
                  backgroundColor:
                    selectedIds.size === phaseFiles.length
                      ? "var(--color-accent)"
                      : "transparent",
                  border:
                    selectedIds.size === phaseFiles.length
                      ? "none"
                      : "1.5px solid var(--color-text-muted)",
                }}
                onClick={() => {
                  if (selectedIds.size === phaseFiles.length) {
                    clearSelection();
                  } else {
                    setSelectedIds(new Set(phaseFiles.map((f) => f.id)));
                  }
                }}
              >
                {selectedIds.size === phaseFiles.length ? (
                  <Check className="w-3 h-3 text-black" strokeWidth={3} />
                ) : selectedIds.size > 0 ? (
                  <div className="w-2 h-0.5 rounded-full bg-text-muted" />
                ) : null}
              </div>
              <span className="ml-3 text-[13px] font-semibold text-accent">
                {selectedIds.size} selected
              </span>
              <button
                onClick={clearSelection}
                className="ml-3 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Clear
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDownload}
                  className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-text-secondary bg-white/[0.04] border border-border-default hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                {isClient && (
                  <>
                    <button
                      onClick={() => handleBulkReview("approved")}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-emerald-400 bg-emerald-400/[0.08] border border-emerald-400/20 hover:bg-emerald-400/[0.15] transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleBulkReview("rejected")}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </>
                )}
                {isStaff && (
                  <>
                    <button
                      onClick={handleBulkMarkReviewed}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-text-secondary bg-white/[0.04] border border-border-default hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Mark Reviewed
                    </button>
                    <button
                      onClick={handleBulkFreeze}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-accent bg-accent/[0.08] border border-accent/20 hover:bg-accent/[0.15] transition-colors cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Freeze Design
                    </button>
                    <button
                      onClick={handleBulkRemove}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 text-xs font-medium text-text-secondary">
                {t("fileName") || "Name of File"}
              </div>
              <div className="w-[120px] text-xs font-medium text-text-secondary">
                {t("fileType") || "Type of File"}
              </div>
              <div className="w-[140px] text-xs font-medium text-text-secondary">
                {t("uploadedBy") || "Uploaded by"}
              </div>
              <div className="w-[110px] text-xs font-medium text-text-secondary">
                {t("uploadedOn") || "Uploaded On"}
              </div>
              <div className="w-[140px] text-xs font-medium text-text-secondary">
                {t("statusLabel").replace(":", "") || "Status"}
              </div>
              <div className="w-[50px]" />
            </>
          )}
        </div>

        {/* Table body */}
        <div className="flex-1">
          {dragOver && !readOnly ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <Upload className="w-8 h-8 text-accent" />
              <p className="text-sm font-medium text-accent">
                Drop files to upload
              </p>
            </div>
          ) : phaseFiles.length === 0 ? (
            readOnly ? (
              <EmptyState
                icon={Upload}
                title={t("noFilesYet")}
                description={t("noFilesDescription")}
              />
            ) : (
              <EmptyState
                icon={Upload}
                title={te("designSectionsTitle")}
                description={te("designSectionsDescription")}
                action={{
                  label: te("designSectionsAction"),
                  onClick: () => openUpload(),
                }}
              />
            )
          ) : (
            phaseFiles.map((att) => {
              const badge = statusBadge(att.review_status);
              const color = avatarColor(att.uploaded_by || "");
              const vc = versionColor(att.version || 1);

              // Remove: PM always, architect only if they uploaded it
              const canRemove =
                isStaff &&
                !att.frozen_at &&
                (userRole === "pm" ||
                  (userRole === "architect" &&
                    att.uploaded_by === currentUserId));

              const fileActions = (
                <div onClick={(e) => e.stopPropagation()}>
                  <FileContextMenu
                    onDownload={() => onDownload(att)}
                    onEdit={
                      isStaff && !att.frozen_at
                        ? () => router.push(reviewPath(att.id))
                        : undefined
                    }
                    onUploadNewVersion={
                      isStaff && !att.frozen_at
                        ? () => openUpload(att.version_group)
                        : undefined
                    }
                    onVersionHistory={
                      att.version_group
                        ? () => setVersionHistoryGroup(att.version_group!)
                        : undefined
                    }
                    onViewReview={
                      att.review_status && att.review_status !== "pending"
                        ? () =>
                            router.push(`${reviewPath(att.id)}?reviews=open`)
                        : undefined
                    }
                    onApprove={
                      isClient && att.review_status !== "approved"
                        ? () => handleReviewAction(att, "approved")
                        : undefined
                    }
                    onReject={
                      isClient && att.review_status !== "rejected"
                        ? () => handleReviewAction(att, "rejected")
                        : undefined
                    }
                    onMarkReviewed={
                      isStaff &&
                      att.review_status !== "approved" &&
                      att.review_status !== "rejected"
                        ? () => handleMarkReviewed(att)
                        : undefined
                    }
                    frozen={!!att.frozen_at}
                    onToggleFreeze={
                      isStaff ? () => handleToggleFreeze(att) : undefined
                    }
                    onRemove={canRemove ? () => handleRemove(att) : undefined}
                  />
                </div>
              );

              const isSelected = selectedIds.has(att.id);

              return (
                <div key={att.id}>
                  {/* Desktop row */}
                  <div
                    className={`group hidden lg:flex items-center h-[52px] px-5 border-b border-border-default last:border-b-0 transition-colors cursor-pointer ${
                      isSelected ? "bg-accent/[0.06]" : "hover:bg-white/[0.02]"
                    }`}
                    onClick={(e) =>
                      hasSelection
                        ? toggleSelect(att.id, e)
                        : router.push(reviewPath(att.id))
                    }
                  >
                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                      <div
                        className="relative shrink-0 w-4 h-4 cursor-pointer"
                        onClick={(e) => {
                          if (!hasSelection) toggleSelect(att.id, e);
                        }}
                      >
                        {/* File icon — hidden on hover (when no selection) or when selected */}
                        <FileText
                          className={`w-4 h-4 text-text-secondary absolute inset-0 transition-opacity ${
                            hasSelection
                              ? "opacity-0"
                              : "opacity-100 group-hover:opacity-0"
                          }`}
                        />
                        {/* Checkbox — shown on hover or when in selection mode */}
                        {isSelected ? (
                          <div
                            className="absolute inset-0 flex items-center justify-center w-4 h-4 rounded-[3px] bg-accent"
                            onClick={(e) => toggleSelect(att.id, e)}
                          >
                            <Check
                              className="w-3 h-3 text-black"
                              strokeWidth={3}
                            />
                          </div>
                        ) : (
                          <div
                            className={`absolute inset-0 w-4 h-4 rounded-[3px] border border-text-muted transition-opacity ${
                              hasSelection
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            onClick={(e) => toggleSelect(att.id, e)}
                          />
                        )}
                        {/* Version badge — hidden when checkbox is showing */}
                        <span
                          className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none transition-opacity ${
                            hasSelection
                              ? "opacity-0"
                              : "opacity-100 group-hover:opacity-0"
                          }`}
                        >
                          V{att.version || 1}
                        </span>
                      </div>
                      {att.frozen_at && (
                        <Lock className="w-3 h-3 text-accent shrink-0" />
                      )}
                      <span className="text-[13px] font-medium text-text-primary truncate">
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
                        {new Date(att.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
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
                      {fileActions}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div
                    className={`flex flex-col gap-2 p-4 border-b border-border-default last:border-b-0 active:bg-white/[0.02] transition-colors cursor-pointer lg:hidden ${
                      isSelected ? "bg-accent/[0.06]" : ""
                    }`}
                    onClick={(e) =>
                      hasSelection
                        ? toggleSelect(att.id, e)
                        : router.push(reviewPath(att.id))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="relative shrink-0 w-4 h-4"
                        onClick={(e) => {
                          if (hasSelection) {
                            toggleSelect(att.id, e);
                          }
                        }}
                      >
                        {hasSelection ? (
                          isSelected ? (
                            <div className="w-4 h-4 rounded-[3px] bg-accent flex items-center justify-center">
                              <Check
                                className="w-3 h-3 text-black"
                                strokeWidth={3}
                              />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-[3px] border border-text-muted" />
                          )
                        ) : (
                          <FileText className="w-4 h-4 text-text-secondary" />
                        )}
                        {!hasSelection && (
                          <span
                            className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none`}
                          >
                            V{att.version || 1}
                          </span>
                        )}
                      </div>
                      {att.frozen_at && (
                        <Lock className="w-3 h-3 text-accent shrink-0" />
                      )}
                      <span className="text-[13px] font-medium text-text-primary truncate flex-1">
                        {att.file_name}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text} shrink-0`}
                      >
                        {badge.label}
                      </span>
                      {fileActions}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{fileType(att.file_name)}</span>
                      <span>
                        {new Date(att.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      {att.uploaded_by_name && (
                        <span className="ml-auto text-text-secondary truncate">
                          {att.uploaded_by_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {!readOnly && (
        <>
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
        </>
      )}
    </div>
  );
}
