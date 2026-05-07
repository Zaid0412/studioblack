"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tasks } from "@/lib/api";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useUserRole } from "@/hooks/useUserRole";
import { useFlag } from "@/hooks/useFlag";
import { DesignsTab } from "../_components/DesignsTab";
import { ProjectWorkflowSteps } from "../_components/ProjectWorkflowSteps";

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
  const boqEnabled = useFlag("boq");

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
  const showWorkflowSteps = !isClient && boqEnabled;

  // When deep-linked with `?highlightTask=<id>`, jump to that task's
  // phase before clearing the param.
  useEffect(() => {
    if (!highlightTaskId || !project) return;
    tasks
      .get(highlightTaskId)
      .then((task) => {
        if (task?.phase_id) setActivePhaseId(task.phase_id);
      })
      .catch(() => {})
      .finally(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("highlightTask");
        router.replace(
          `${window.location.pathname}${params.size ? `?${params}` : ""}`,
          { scroll: false }
        );
      });
  }, [highlightTaskId, project, setActivePhaseId, router, searchParams]);

  if (!project) return null;

  return (
    <>
      {showWorkflowSteps && (
        <ProjectWorkflowSteps
          projectId={id}
          fileCount={Array.from(phaseCounts.values()).reduce(
            (sum, n) => sum + n,
            0
          )}
          showBoq={showWorkflowSteps}
        />
      )}

      <DesignsTab
        projectId={id}
        project={project}
        role={role}
        currentUserId={session?.user?.id}
        activeTab="designs"
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
