import { useState, useEffect, useCallback } from "react";
import {
  projects as projectsApi,
  attachments as attachmentsApi,
  comments as commentsApi,
  approvals as approvalsApi,
  tasks as tasksApi,
} from "@/lib/api";

export interface Phase {
  id: string;
  name: string;
  phase_order: number;
  status: string;
}

export interface Member {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  description: string;
  phase_id: string | null;
  task_id: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  review_status?: string;
  version?: number;
  version_group?: string;
  frozen_at?: string | null;
}

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface Approval {
  id: string;
  decision: "approved" | "changes_requested";
  comment: string;
  user_name: string;
  created_at: string;
}

export interface PendingTask {
  id: string;
  title: string;
  description: string;
  phase_name: string;
  assigned_name: string | null;
  review_status: string;
  created_at: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  status: string;
  description: string;
  deadline: string | null;
  created_at: string;
  phases: Phase[];
  members: Member[];
}

/**
 *
 */
export function useClientProjectDetail(id: string) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      projectsApi.get<ProjectDetail>(id),
      attachmentsApi.list(id, { all: true }).catch(() => [] as Attachment[]),
      commentsApi.list(id).catch(() => [] as Comment[]),
      approvalsApi.list<Approval>(id).catch(() => [] as Approval[]),
      tasksApi
        .getPendingReview<PendingTask>(id)
        .catch(() => [] as PendingTask[]),
    ])
      .then(
        ([
          projectData,
          attachmentData,
          commentData,
          approvalData,
          pendingTaskData,
        ]) => {
          setProject(projectData);
          setAttachments(attachmentData as Attachment[]);
          setComments(commentData as Comment[]);
          setApprovals(approvalData);
          setPendingTasks(pendingTaskData);
          if (projectData.phases?.length > 0) {
            setActivePhaseId(projectData.phases[0].id);
          }
        }
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendComment = useCallback(async () => {
    if (!newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await commentsApi.create(id, newComment.trim());
      const updated = await commentsApi.list(id).catch(() => [] as Comment[]);
      setComments(updated as Comment[]);
      setNewComment("");
    } catch {
      // keep existing comments on failure
    } finally {
      setSendingComment(false);
    }
  }, [id, newComment, sendingComment]);

  const handleDecision = async (
    decision: "approved" | "changes_requested",
    comment?: string
  ) => {
    if (submittingDecision) return;
    setSubmittingDecision(true);
    try {
      await approvalsApi.submit(id, { decision, comment: comment || "" });
      const [updatedApprovals, updatedProject] = await Promise.all([
        approvalsApi.list<Approval>(id).catch(() => [] as Approval[]),
        projectsApi.get<ProjectDetail>(id).catch(() => null),
      ]);
      setApprovals(updatedApprovals);
      if (updatedProject) setProject(updatedProject);
    } catch {
      // keep existing state on failure
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleTaskReview = async (
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
      // keep existing state on failure
    } finally {
      setReviewingTaskId(null);
    }
  };

  // Count attachments per phase
  const phaseCounts = new Map<string, number>();
  for (const a of attachments) {
    if (a.phase_id)
      phaseCounts.set(a.phase_id, (phaseCounts.get(a.phase_id) || 0) + 1);
  }
  const phaseFiles = attachments.filter((a) => a.phase_id === activePhaseId);

  return {
    project,
    loading,
    error,
    attachments,
    comments,
    approvals,
    pendingTasks,
    activePhaseId,
    setActivePhaseId,
    phaseCounts,
    phaseFiles,
    // Comment state + handler
    newComment,
    setNewComment,
    sendingComment,
    handleSendComment,
    // Decision state + handler
    submittingDecision,
    handleDecision,
    changesDialogOpen,
    setChangesDialogOpen,
    changesComment,
    setChangesComment,
    // Task review
    reviewingTaskId,
    handleTaskReview,
  };
}
