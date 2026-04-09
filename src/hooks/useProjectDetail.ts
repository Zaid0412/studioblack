"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import type {
  DbAttachment,
  DbComment,
  DbProjectDetail,
  DbApproval,
  DbPendingTask,
} from "@/types";
import {
  comments as commentsApi,
  approvals as approvalsApi,
  tasks as tasksApi,
  upload,
} from "@/lib/api";
import { toast } from "@/components/ui/useToast";

interface UseProjectDetailOptions {
  /** When true, also fetches approvals and pending tasks (client-specific). */
  includeApprovals?: boolean;
}

/** Unified hook for project detail — used by both PM and client pages. */
export function useProjectDetail(
  id: string,
  options?: UseProjectDetailOptions
) {
  const includeApprovals = options?.includeApprovals ?? false;

  // -- SWR data fetching --
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
    mutate: mutateProject,
  } = useSWR<DbProjectDetail>(`/api/projects/${id}`);

  const {
    data: attachments = [],
    isLoading: attachmentsLoading,
    mutate: mutateAttachments,
  } = useSWR<DbAttachment[]>(`/api/projects/${id}/attachments?all=true`);

  const {
    data: comments = [],
    isLoading: commentsLoading,
    mutate: mutateComments,
  } = useSWR<DbComment[]>(`/api/projects/${id}/comments`);

  const { data: approvals = [], mutate: mutateApprovals } = useSWR<
    DbApproval[]
  >(includeApprovals ? `/api/projects/${id}/approvals` : null);

  const { data: pendingTasks = [], mutate: mutatePendingTasks } = useSWR<
    DbPendingTask[]
  >(includeApprovals ? `/api/projects/${id}/tasks/pending-review` : null);

  // -- UI state --
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  const loading = projectLoading || attachmentsLoading || commentsLoading;
  const error = !!projectError;

  // Set initial phase when project data arrives
  useEffect(() => {
    if (project?.phases?.length && !activePhaseId) {
      setActivePhaseId(project.phases[0].id);
    }
  }, [project, activePhaseId]);

  // --- Comments ---
  const handleSendComment = useCallback(async () => {
    if (!newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await commentsApi.create(id, newComment.trim());
      mutateComments();
      setNewComment("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to send comment",
        variant: "error",
      });
    } finally {
      setSendingComment(false);
    }
  }, [id, newComment, sendingComment, mutateComments]);

  // --- Refresh ---
  const refreshAttachments = useCallback(() => {
    mutateAttachments();
  }, [mutateAttachments]);

  const refreshAll = useCallback(() => {
    mutateProject();
    mutateAttachments();
    mutateComments();
    if (includeApprovals) {
      mutateApprovals();
      mutatePendingTasks();
    }
  }, [
    mutateProject,
    mutateAttachments,
    mutateComments,
    includeApprovals,
    mutateApprovals,
    mutatePendingTasks,
  ]);

  // --- Download ---
  const handleDownload = useCallback(async (att: DbAttachment) => {
    try {
      const blob = await upload.downloadFile(att.file_url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  }, []);

  // --- Client: project approval ---
  const handleDecision = useCallback(
    async (decision: "approved" | "changes_requested", comment?: string) => {
      if (submittingDecision) return;
      setSubmittingDecision(true);
      try {
        await approvalsApi.submit(id, { decision, comment: comment || "" });
        mutateApprovals();
        mutateProject();
      } catch {
        toast({
          title: "Error",
          description: "Failed to submit decision",
          variant: "error",
        });
      } finally {
        setSubmittingDecision(false);
      }
    },
    [id, submittingDecision, mutateApprovals, mutateProject]
  );

  // --- Client: task review ---
  const handleTaskReview = useCallback(
    async (
      taskId: string,
      action: "approved" | "changes_requested",
      comment?: string
    ) => {
      setReviewingTaskId(taskId);
      try {
        await tasksApi.submitReview(id, taskId, {
          action,
          comment: comment || "",
        });
        mutatePendingTasks((prev) => prev?.filter((t) => t.id !== taskId), {
          revalidate: false,
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to submit task review",
          variant: "error",
        });
      } finally {
        setReviewingTaskId(null);
      }
    },
    [id, mutatePendingTasks]
  );

  // --- Derived ---
  const phaseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of attachments) {
      if (a.phase_id) counts.set(a.phase_id, (counts.get(a.phase_id) || 0) + 1);
    }
    return counts;
  }, [attachments]);

  const phaseFiles = useMemo(
    () => attachments.filter((a) => a.phase_id === activePhaseId),
    [attachments, activePhaseId]
  );

  return {
    project: project ?? null,
    attachments,
    comments,
    approvals,
    pendingTasks,
    loading,
    error,
    activePhaseId,
    setActivePhaseId,
    phaseCounts,
    phaseFiles,
    // Comments
    newComment,
    setNewComment,
    sendingComment,
    handleSendComment,
    // Refresh
    refreshAttachments,
    refreshAll,
    handleDownload,
    // Client: approvals
    submittingDecision,
    handleDecision,
    changesDialogOpen,
    setChangesDialogOpen,
    changesComment,
    setChangesComment,
    // Client: task review
    reviewingTaskId,
    handleTaskReview,
  };
}
