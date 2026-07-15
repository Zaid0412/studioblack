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
} from "@/lib/api";
import type { PhaseAttachmentCount } from "@/lib/api/attachments";
import { toast } from "@/components/ui/useToast";
import { downloadFile } from "@/lib/download";
import { trackEvent } from "@/lib/analytics";

interface UseProjectDetailOptions {
  /** When true, also fetches approvals and pending tasks (client-specific). */
  includeApprovals?: boolean;
  /**
   * When true, fetch the full attachment list (needed to render files, e.g.
   * DesignsTab via `phaseFiles`). Default false — only the lightweight
   * per-phase counts are fetched, so routes that just show the stepper/MetaBar
   * don't download every full attachment row.
   */
  includeAttachments?: boolean;
}

/** Unified hook for project detail — used by both PM and client pages. */
export function useProjectDetail(
  id: string,
  options?: UseProjectDetailOptions
) {
  const includeApprovals = options?.includeApprovals ?? false;
  const includeAttachments = options?.includeAttachments ?? false;

  // -- SWR data fetching --
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
    mutate: mutateProject,
  } = useSWR<DbProjectDetail>(`/api/projects/${id}`);

  // The full attachment list is only fetched where files actually render
  // (DesignsTab). Everywhere else the layout consumes `phaseCounts` from the
  // lightweight endpoint below, so the full list stays unfetched.
  const {
    data: attachments = [],
    isLoading: attachmentsLoading,
    mutate: mutateAttachments,
  } = useSWR<DbAttachment[]>(
    includeAttachments ? `/api/projects/${id}/attachments?all=true` : null
  );

  const {
    data: phaseCountRows = [],
    isLoading: phaseCountsLoading,
    mutate: mutatePhaseCounts,
  } = useSWR<PhaseAttachmentCount[]>(
    `/api/projects/${id}/attachments/phase-counts`
  );

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
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  // `loading` is true while ANY resource is in flight — useful for a full-page
  // spinner, but too broad for chrome that only needs the project. Consumers
  // that can render as soon as the primary resource lands (e.g. the project
  // layout) should gate on `initialLoading`, so a secondary revalidation
  // (comments, phase-counts) doesn't re-flash a skeleton over cached content.
  const loading =
    projectLoading ||
    attachmentsLoading ||
    phaseCountsLoading ||
    commentsLoading;
  const initialLoading = projectLoading;
  const error = !!projectError;

  // Set initial phase when project data arrives — default to the first
  // *enabled* phase so a disabled phase (hidden from PhaseTabs) never ends
  // up silently selected.
  useEffect(() => {
    if (project?.phases?.length && !activePhaseId) {
      const firstEnabled = project.phases.find((p) => p.enabled);
      if (firstEnabled) setActivePhaseId(firstEnabled.id);
    }
  }, [project, activePhaseId]);

  // --- Comments ---
  // The text input + sending flag live in `<CommentsSection>`. This
  // hook only owns the API call so the layout doesn't re-render its
  // entire subtree on every keystroke.
  const submitComment = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      try {
        await commentsApi.create(id, trimmed);
        trackEvent("comment_added", { project_id: id });
        mutateComments();
        return true;
      } catch {
        toast({
          title: "Error",
          description: "Failed to send comment",
          variant: "error",
        });
        return false;
      }
    },
    [id, mutateComments]
  );

  // --- Refresh ---
  // Mutate both the full list (if fetched) and the counts so the stepper/MetaBar
  // update after an upload/delete regardless of which route is mounted.
  const refreshAttachments = useCallback(() => {
    mutateAttachments();
    mutatePhaseCounts();
  }, [mutateAttachments, mutatePhaseCounts]);

  const refreshAll = useCallback(() => {
    mutateProject();
    mutateAttachments();
    mutatePhaseCounts();
    mutateComments();
    if (includeApprovals) {
      mutateApprovals();
      mutatePendingTasks();
    }
  }, [
    mutateProject,
    mutateAttachments,
    mutatePhaseCounts,
    mutateComments,
    includeApprovals,
    mutateApprovals,
    mutatePendingTasks,
  ]);

  // --- Download ---
  const handleDownload = useCallback(async (att: DbAttachment) => {
    try {
      await downloadFile(att.file_url, att.file_name);
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
        trackEvent("task_completed", {
          project_id: id,
          task_id: taskId,
          action,
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
  // Counts come from the lightweight endpoint (one integer per phase), not from
  // walking the full attachment list — which is unfetched on non-Designs routes.
  const phaseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of phaseCountRows) counts.set(r.phase_id, r.count);
    return counts;
  }, [phaseCountRows]);

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
    initialLoading,
    error,
    activePhaseId,
    setActivePhaseId,
    phaseCounts,
    phaseFiles,
    // Comments
    submitComment,
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
