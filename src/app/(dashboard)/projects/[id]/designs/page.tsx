"use client";

import { use, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tasks } from "@/lib/api";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useUserRole } from "@/hooks/useUserRole";
import { DesignsTab } from "../_components/DesignsTab";

/**
 * Design tab — phases / files / tasks / approvals. Mounted under the
 * shared project layout, which provides the project header, meta bar,
 * and comments section.
 */
export default function ProjectDesignsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { role, session } = useUserRole();
  const isClient = role === "client";

  const {
    project,
    pendingTasks,
    approvals,
    activePhaseId,
    setActivePhaseId,
    phaseCounts,
    phaseFiles,
    handleDownload,
    refreshAttachments,
    reviewingTaskId,
    handleTaskReview,
  } = useProjectDetail(id, { includeApprovals: isClient });

  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightTaskId = searchParams.get("highlightTask");

  // When deep-linked with `?highlightTask=<id>`, jump to that task's
  // phase and clear the param. The ref guard ensures we only fire the
  // task fetch once per highlightTaskId — without it, a project SWR
  // revalidation mid-flight would re-trigger the fetch (since `project`
  // would be in deps).
  const handledHighlightRef = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightTaskId || !project) return;
    if (handledHighlightRef.current === highlightTaskId) return;
    handledHighlightRef.current = highlightTaskId;
    tasks
      .get(highlightTaskId)
      .then((task) => {
        if (task?.phase_id) setActivePhaseId(task.phase_id);
      })
      .catch(() => {})
      .finally(() => {
        // Read from window.location at flush time so we don't depend on
        // the (frequently-changing) `searchParams` object.
        const params = new URLSearchParams(window.location.search);
        params.delete("highlightTask");
        router.replace(
          `${window.location.pathname}${params.size ? `?${params}` : ""}`,
          { scroll: false }
        );
      });
  }, [highlightTaskId, project, setActivePhaseId, router]);

  if (!project) return null;

  return (
    <>
      <DesignsTab
        projectId={id}
        project={project}
        role={role}
        currentUserId={session?.user?.id}
        activePhaseId={activePhaseId}
        setActivePhaseId={setActivePhaseId}
        phaseCounts={phaseCounts}
        phaseFiles={phaseFiles}
        pendingTasks={pendingTasks}
        approvals={approvals}
        reviewingTaskId={reviewingTaskId}
        handleTaskReview={handleTaskReview}
        handleDownload={handleDownload}
        refreshAttachments={refreshAttachments}
        highlightTaskId={highlightTaskId}
      />
    </>
  );
}
