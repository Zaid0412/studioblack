"use client";

import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    const fetches: Promise<unknown>[] = [
      projectsApi.get<DbProjectDetail>(id),
      attachmentsApi.list(id, { all: true }).catch(() => [] as DbAttachment[]),
      commentsApi.list(id).catch(() => [] as DbComment[]),
    ];

    if (includeApprovals) {
      fetches.push(
        approvalsApi.list<DbApproval>(id).catch(() => [] as DbApproval[]),
        tasksApi
          .getPendingReview<DbPendingTask>(id)
          .catch(() => [] as DbPendingTask[])
      );
    }

    Promise.all(fetches)
      .then(
        ([projectData, attachData, commentData, approvalData, taskData]) => {
          setProject(projectData as DbProjectDetail);
          setAttachments(attachData as DbAttachment[]);
          setComments(commentData as DbComment[]);
          if (includeApprovals) {
            setApprovals((approvalData as DbApproval[]) || []);
            setPendingTasks((taskData as DbPendingTask[]) || []);
          }
          const p = projectData as DbProjectDetail;
          if (p.phases?.length > 0) {
            setActivePhaseId(p.phases[0].id);
          }
        }
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, includeApprovals]);

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
      /* keep existing */
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

  const refreshAll = useCallback(async () => {
    const fetches: Promise<unknown>[] = [
      projectsApi.get<DbProjectDetail>(id).catch(() => null),
      attachmentsApi.list(id, { all: true }).catch(() => [] as DbAttachment[]),
      commentsApi.list(id).catch(() => [] as DbComment[]),
    ];
    if (includeApprovals) {
      fetches.push(
        approvalsApi.list<DbApproval>(id).catch(() => [] as DbApproval[]),
        tasksApi
          .getPendingReview<DbPendingTask>(id)
          .catch(() => [] as DbPendingTask[])
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
  }, [id, includeApprovals]);

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
          approvalsApi.list<DbApproval>(id).catch(() => [] as DbApproval[]),
          projectsApi.get<DbProjectDetail>(id).catch(() => null),
        ]);
        setApprovals(updatedApprovals);
        if (updatedProject) setProject(updatedProject);
      } catch {
        /* keep existing */
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
        /* keep existing */
      } finally {
        setReviewingTaskId(null);
      }
    },
    [id]
  );

  // --- Derived ---
  const phaseCounts = new Map<string, number>();
  for (const a of attachments) {
    if (a.phase_id)
      phaseCounts.set(a.phase_id, (phaseCounts.get(a.phase_id) || 0) + 1);
  }
  const phaseFiles = attachments.filter((a) => a.phase_id === activePhaseId);

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
