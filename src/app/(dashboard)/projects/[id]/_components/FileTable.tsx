"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useLongPress } from "@/hooks/useLongPress";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, FileText, Check } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { UploadDesignDialog } from "./UploadDesignDialog";
import {
  SortableHeaderButton,
  nextSortDirection,
  type SortConfig,
} from "@/components/ui/SortableHeader";
import { VersionHistoryDialog } from "./VersionHistoryDialog";
import { BulkActions } from "./BulkActions";
import { FileRow } from "./FileRow";
import { FileCard } from "./FileCard";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import { fileType, statusBadge } from "@/lib/fileUtils";
import { attachments as attachmentsApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { useFileDropzone } from "@/hooks/useFileDropzone";
import type { DbAttachment, UserRole } from "@/types";

type SortKey = "name" | "type" | "uploadedBy" | "uploadedOn" | "status";

const STATUS_WEIGHT: Record<string, number> = {
  pending: 0,
  reviewed: 1,
  approved: 2,
  changes_requested: 3,
  rejected: 4,
};

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
  userRole: UserRole | null;
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

  const [sortState, setSortState] = useState<{
    phaseId: string | null;
    sort: SortConfig<SortKey>;
  }>({ phaseId: activePhaseId, sort: null });

  // Auto-reset: if the phase changed, the derived sortConfig becomes null
  const sortConfig =
    sortState.phaseId === activePhaseId ? sortState.sort : null;

  const updateSort = useCallback(
    (key: SortKey) =>
      setSortState((prev) => ({
        phaseId: activePhaseId,
        sort: nextSortDirection(
          prev.phaseId === activePhaseId ? prev.sort : null,
          key
        ),
      })),
    [activePhaseId]
  );

  const sortedFiles = useMemo(() => {
    if (!sortConfig) return phaseFiles;
    const { key, direction } = sortConfig;
    const sorted = [...phaseFiles].sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case "name":
          cmp = a.file_name.localeCompare(b.file_name, undefined, {
            sensitivity: "base",
          });
          break;
        case "type":
          cmp = fileType(a.file_name).localeCompare(
            fileType(b.file_name),
            undefined,
            { sensitivity: "base" }
          );
          break;
        case "uploadedBy":
          cmp = (a.uploaded_by_name || "").localeCompare(
            b.uploaded_by_name || "",
            undefined,
            { sensitivity: "base" }
          );
          break;
        case "uploadedOn":
          cmp =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "status":
          cmp =
            (STATUS_WEIGHT[a.review_status || "pending"] ?? 0) -
            (STATUS_WEIGHT[b.review_status || "pending"] ?? 0);
          break;
      }
      return direction === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [phaseFiles, sortConfig]);

  const listRef = useStaggerReveal<HTMLDivElement>(
    sortedFiles.map((f) => f.id).join(",")
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVersionGroup, setUploadVersionGroup] = useState<string | null>(
    null
  );
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
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

  const {
    dragOver,
    handleDrop: handleTableDrop,
    handleDragOver: handleTableDragOver,
    handleDragLeave: handleTableDragLeave,
  } = useFileDropzone(
    useCallback(
      (files: FileList) => openUpload(null, Array.from(files)),
      [openUpload]
    )
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

  const handleSendToClient = useCallback(
    async (att: DbAttachment) => {
      try {
        await attachmentsApi.sendToClient(projectId, att.id);
        toast({
          title: "Sent to client",
          description: `"${att.file_name}" is now visible to the client.`,
          variant: "success",
        });
        onRefresh();
      } catch {
        toast({
          title: "Error",
          description: "Failed to send file to client.",
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

  const selectedFiles = useMemo(
    () => phaseFiles.filter((f) => selectedIds.has(f.id)),
    [phaseFiles, selectedIds]
  );

  const handleBulkDownload = useCallback(() => {
    for (const att of selectedFiles) onDownload(att);
    clearSelection();
  }, [selectedFiles, onDownload, clearSelection]);

  // Shared bulk action helper — runs action, toasts, clears selection, refreshes
  const bulkAction = useCallback(
    async (
      action: () => Promise<PromiseSettledResult<unknown>[]>,
      successTitle: string,
      successDesc: string,
      errorDesc: string
    ) => {
      const results = await action();
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length === 0) {
        toast({
          title: successTitle,
          description: successDesc,
          variant: "success",
        });
      } else if (failures.length < results.length) {
        toast({
          title: t("bulkError"),
          description: `${failures.length} of ${results.length} failed`,
          variant: "error",
        });
      } else {
        toast({
          title: t("bulkError"),
          description: errorDesc,
          variant: "error",
        });
      }
      clearSelection();
      onRefresh();
    },
    [clearSelection, onRefresh, t]
  );

  const handleBulkReview = useCallback(
    (status: "approved" | "rejected") =>
      bulkAction(
        () =>
          Promise.allSettled(
            selectedFiles.map((att) =>
              attachmentsApi.submitReview(projectId, att.id, { status })
            )
          ),
        status === "approved"
          ? t("bulkDesignsApproved")
          : t("bulkDesignsRejected"),
        status === "approved"
          ? t("bulkFilesApproved", { count: selectedFiles.length })
          : t("bulkFilesRejected", { count: selectedFiles.length }),
        status === "approved" ? t("bulkApproveError") : t("bulkRejectError")
      ),
    [selectedFiles, projectId, bulkAction, t]
  );

  const handleBulkMarkReviewed = useCallback(
    () =>
      bulkAction(
        () =>
          Promise.allSettled(
            selectedFiles.map((att) =>
              attachmentsApi.markReviewed(projectId, att.id)
            )
          ),
        t("bulkMarkedReviewed"),
        t("bulkMarkedReviewedDesc", { count: selectedFiles.length }),
        t("bulkMarkReviewedError")
      ),
    [selectedFiles, projectId, bulkAction, t]
  );

  const handleBulkRemove = useCallback(() => {
    const confirmed = window.confirm(
      t("bulkRemoveConfirm", { count: selectedFiles.length })
    );
    if (!confirmed) return;
    return bulkAction(
      () =>
        Promise.allSettled(
          selectedFiles.map((att) => attachmentsApi.remove(projectId, att.id))
        ),
      t("bulkFilesRemoved"),
      t("bulkFilesRemovedDesc", { count: selectedFiles.length }),
      t("bulkRemoveError")
    );
  }, [selectedFiles, projectId, bulkAction, t]);

  const handleBulkSendToClient = useCallback(() => {
    const unsent = selectedFiles.filter((att) => !att.sent_to_client_at);
    if (unsent.length === 0) return Promise.resolve();
    return bulkAction(
      () =>
        Promise.allSettled(
          unsent.map((att) => attachmentsApi.sendToClient(projectId, att.id))
        ),
      t("bulkSentToClient"),
      t("bulkSentToClientDesc", { count: unsent.length }),
      t("bulkSendToClientError")
    );
  }, [selectedFiles, projectId, bulkAction, t]);

  const handleBulkFreeze = useCallback(
    () =>
      bulkAction(
        () =>
          Promise.allSettled(
            selectedFiles
              .filter((att) => !att.frozen_at)
              .map((att) => attachmentsApi.freeze(projectId, att.id))
          ),
        t("bulkDesignsFrozen"),
        t("bulkDesignsFrozenDesc", { count: selectedFiles.length }),
        t("bulkFreezeError")
      ),
    [selectedFiles, projectId, bulkAction, t]
  );

  const bulkActionProps = useMemo(
    () => ({
      isClient,
      isStaff,
      onDownload: handleBulkDownload,
      onApprove: () => handleBulkReview("approved"),
      onReject: () => handleBulkReview("rejected"),
      onSendToClient: handleBulkSendToClient,
      onMarkReviewed: handleBulkMarkReviewed,
      onFreeze: handleBulkFreeze,
      onRemove: handleBulkRemove,
    }),
    [
      isClient,
      isStaff,
      handleBulkDownload,
      handleBulkReview,
      handleBulkSendToClient,
      handleBulkMarkReviewed,
      handleBulkFreeze,
      handleBulkRemove,
    ]
  );

  // Long-press on mobile to enter selection mode. Hook handles timer
  // lifecycle, haptic, context-menu suppression, and click-swallow flag.
  const longPress = useLongPress<string>(
    (attId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(attId)) next.delete(attId);
        else next.add(attId);
        return next;
      });
    },
    { durationMs: 400 }
  );

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
                role="checkbox"
                aria-checked={
                  selectedIds.size === phaseFiles.length
                    ? true
                    : selectedIds.size > 0
                      ? "mixed"
                      : false
                }
                aria-label="Select all files"
                tabIndex={0}
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
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    if (selectedIds.size === phaseFiles.length) {
                      clearSelection();
                    } else {
                      setSelectedIds(new Set(phaseFiles.map((f) => f.id)));
                    }
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
              <BulkActions variant="desktop" {...bulkActionProps} />
            </>
          ) : (
            <>
              {(
                [
                  {
                    key: "name" as SortKey,
                    width: "flex-1",
                    label: t("fileName") || "Name of File",
                  },
                  {
                    key: "type" as SortKey,
                    width: "w-[120px]",
                    label: t("fileType") || "Type of File",
                  },
                  {
                    key: "uploadedBy" as SortKey,
                    width: "w-[140px]",
                    label: t("uploadedBy") || "Uploaded by",
                  },
                  {
                    key: "uploadedOn" as SortKey,
                    width: "w-[110px]",
                    label: t("uploadedOn") || "Uploaded On",
                  },
                  {
                    key: "status" as SortKey,
                    width: "w-[140px]",
                    label: t("statusLabel").replace(/[:\s]+$/, ""),
                  },
                ] as const
              ).map(({ key, width, label }) => (
                <SortableHeaderButton
                  key={key}
                  sortKey={key}
                  config={sortConfig}
                  onSort={updateSort}
                  className={width}
                >
                  {label}
                </SortableHeaderButton>
              ))}
              <div className="w-[50px]" />
            </>
          )}
        </div>

        {/* Table body */}
        <div ref={listRef} className="flex-1">
          {dragOver && !readOnly ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <Upload className="w-8 h-8 text-accent" />
              <p className="text-sm font-medium text-accent">
                Drop files to upload
              </p>
            </div>
          ) : sortedFiles.length === 0 ? (
            readOnly ? (
              <EmptyState
                icon={FileText}
                title="No designs to review"
                description="Your team hasn't shared any designs for review yet. You'll be notified when a design is ready."
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
            sortedFiles.map((att) => {
              const isNewForClient =
                isClient &&
                (!att.review_status || att.review_status === "pending");
              const badge = isNewForClient
                ? {
                    bg: "bg-blue-500/15",
                    text: "text-blue-500",
                    label: "New",
                  }
                : statusBadge(att.review_status);

              // Remove: PM always, architect only if they uploaded it
              const canRemove =
                isStaff &&
                !att.frozen_at &&
                (userRole === "pm" ||
                  (userRole === "architect" &&
                    att.uploaded_by === currentUserId));

              const isSelected = selectedIds.has(att.id);

              const contextMenuProps = {
                onDownload: () => onDownload(att),
                onEdit:
                  isStaff && !att.frozen_at
                    ? () => router.push(reviewPath(att.id))
                    : undefined,
                onUploadNewVersion:
                  isStaff && !att.frozen_at
                    ? () => openUpload(att.version_group)
                    : undefined,
                onVersionHistory: (() => {
                  const vg = att.version_group;
                  return vg ? () => setVersionHistoryGroup(vg) : undefined;
                })(),
                onViewReview:
                  att.review_status && att.review_status !== "pending"
                    ? () => router.push(`${reviewPath(att.id)}?reviews=open`)
                    : undefined,
                onApprove:
                  isClient && att.review_status !== "approved"
                    ? () => handleReviewAction(att, "approved")
                    : undefined,
                onReject:
                  isClient && att.review_status !== "rejected"
                    ? () => handleReviewAction(att, "rejected")
                    : undefined,
                onMarkReviewed:
                  isStaff &&
                  att.review_status !== "approved" &&
                  att.review_status !== "rejected"
                    ? () => handleMarkReviewed(att)
                    : undefined,
                onSendToClient:
                  isStaff && !att.sent_to_client_at
                    ? () => handleSendToClient(att)
                    : undefined,
                frozen: !!att.frozen_at,
                onToggleFreeze: isStaff
                  ? () => handleToggleFreeze(att)
                  : undefined,
                onRemove: canRemove ? () => handleRemove(att) : undefined,
              };

              const sharedProps = {
                att,
                isSelected,
                hasSelection,
                isStaff,
                isNewForClient,
                badge,
                onToggleSelect: (e: React.MouseEvent) =>
                  toggleSelect(att.id, e),
                contextMenuProps,
              };

              return (
                <div key={att.id} data-anim-item>
                  <FileRow
                    {...sharedProps}
                    onRowClick={(e) =>
                      hasSelection
                        ? toggleSelect(att.id, e)
                        : router.push(reviewPath(att.id))
                    }
                  />
                  <FileCard
                    {...sharedProps}
                    onTouchStart={() => longPress.start(att.id)}
                    onTouchEnd={longPress.cancel}
                    onTouchMove={longPress.cancel}
                    onContextMenu={longPress.preventContextMenu}
                    onClick={(e) => {
                      if (longPress.consumeFired()) return;
                      if (hasSelection) {
                        toggleSelect(att.id, e);
                      } else {
                        router.push(reviewPath(att.id));
                      }
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile bulk action bar */}
      {hasSelection && (
        <div className="fixed bottom-14 inset-x-0 z-40 lg:hidden bg-bg-secondary border-t border-border-default px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-accent shrink-0">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-[10px] text-text-muted hover:text-text-primary cursor-pointer shrink-0"
            >
              Clear
            </button>
            <div className="flex-1" />
            <BulkActions variant="mobile" {...bulkActionProps} />
          </div>
        </div>
      )}

      {!readOnly && (
        <UploadDesignDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          projectId={projectId}
          phaseId={activePhaseId}
          versionGroup={uploadVersionGroup}
          initialFiles={droppedFiles}
          onSuccess={onRefresh}
        />
      )}

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
