"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  DbAttachment,
  DbComment,
  DbProjectDetail,
  DbApproval,
  DbPendingTask,
} from "@/types";
import {
  projects as projectsApi,
  attachments as attachmentsApi,
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

  const [project, setProject] = useState<DbProjectDetail | null>(null);
  const [attachments, setAttachments] = useState<DbAttachment[]>([]);
  const [comments, setComments] = useState<DbComment[]>([]);
  const [approvals, setApprovals] = useState<DbApproval[]>([]);
  const [pendingTasks, setPendingTasks] = useState<DbPendingTask[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  const fetchAll = useCallback(
    async (opts?: { setInitialPhase?: boolean }) => {
      const fetches: Promise<unknown>[] = [
        projectsApi.get<DbProjectDetail>(id).catch(() => null),
        attachmentsApi
          .list(id, { all: true })
          .catch(() => [] as DbAttachment[]),
        commentsApi.list(id).catch(() => [] as DbComment[]),
      ];

      if (includeApprovals) {
        fetches.push(
          approvalsApi.list(id).catch(() => [] as DbApproval[]),
          tasksApi.getPendingReview(id).catch(() => [] as DbPendingTask[])
        );
      }

      const [projectData, attachData, commentData, approvalData, taskData] =
        await Promise.all(fetches);
      if (projectData) setProject(projectData as DbProjectDetail);
      setAttachments(attachData as DbAttachment[]);
      setComments(commentData as DbComment[]);
      if (includeApprovals) {
        setApprovals((approvalData as DbApproval[]) || []);
        setPendingTasks((taskData as DbPendingTask[]) || []);
      }
      if (opts?.setInitialPhase) {
        const p = projectData as DbProjectDetail | null;
        if (p?.phases?.length) {
          setActivePhaseId(p.phases[0].id);
        }
      }
    },
    [id, includeApprovals]
  );

  useEffect(() => {
    fetchAll({ setInitialPhase: true })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [fetchAll]);

  // --- Comments ---
  const handleSendComment = useCallback(async () => {
    if (!newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await commentsApi.create(id, newComment.trim());
      const updated = await commentsApi.list(id).catch(() => [] as DbComment[]);
      setComments(updated);
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
  }, [id, newComment, sendingComment]);

  // --- Refresh ---
  const refreshAttachments = useCallback(async () => {
    try {
      setAttachments(await attachmentsApi.list(id, { all: true }));
    } catch {
      /* keep existing */
    }
  }, [id]);

  const refreshAll = useCallback(() => fetchAll(), [fetchAll]);

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
        const [updatedApprovals, updatedProject] = await Promise.all([
          approvalsApi.list(id).catch(() => [] as DbApproval[]),
          projectsApi.get<DbProjectDetail>(id).catch(() => null),
        ]);
        setApprovals(updatedApprovals);
        if (updatedProject) setProject(updatedProject);
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
    [id, submittingDecision]
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
        setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
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
    [id]
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
    project,
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
