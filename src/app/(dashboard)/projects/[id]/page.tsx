"use client";

import { use, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { tasks } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useProjectDetail } from "./_hooks/useProjectDetail";
import { ProjectHeader } from "./_components/ProjectHeader";
import { MetaBar } from "./_components/MetaBar";
import { WorkflowBar } from "./_components/WorkflowBar";
import { PhaseTabs } from "./_components/PhaseTabs";
import { FileTable } from "./_components/FileTable";
import { TaskSection } from "./_components/TaskSection";
import { CommentsSection } from "./_components/CommentsSection";

/** Project detail page — workflow steps, phase tabs, file table. */
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tc = useTranslations("common");

  const {
    project,
    attachments,
    comments,
    newComment,
    setNewComment,
    sendingComment,
    loading,
    error,
    activePhaseId,
    setActivePhaseId,
    handleSendComment,
    handleDownload,
    refreshAttachments,
    refreshAll,
  } = useProjectDetail(id);

  const uploadTriggerRef = useRef<(() => void) | null>(null);

  const searchParams = useSearchParams();
  const highlightTaskId = searchParams.get("highlightTask");

  useEffect(() => {
    if (!highlightTaskId || !project) return;
    tasks
      .get<{ phase_id: string }>(highlightTaskId)
      .then((task) => {
        if (task?.phase_id) setActivePhaseId(task.phase_id);
      })
      .catch(() => {});
  }, [highlightTaskId, project, setActivePhaseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-[#666666]">{tc("projectNotFound")}</p>
      </div>
    );
  }

  const phaseCounts = new Map<string, number>();
  for (const a of attachments) {
    if (a.phase_id)
      phaseCounts.set(a.phase_id, (phaseCounts.get(a.phase_id) || 0) + 1);
  }
  const phaseFiles = attachments.filter((a) => a.phase_id === activePhaseId);

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader projectName={project.name} onRefresh={refreshAll} />
      <MetaBar
        clientName={project.client_name}
        clientEmail={project.client_email}
        members={project.members}
        createdAt={project.created_at}
        phases={project.phases}
        phaseCounts={phaseCounts}
      />
      <WorkflowBar
        projectId={id}
        steps={project.steps}
        onUpload={() => uploadTriggerRef.current?.()}
      />
      <PhaseTabs
        phases={project.phases}
        activePhaseId={activePhaseId}
        phaseCounts={phaseCounts}
        onPhaseChange={setActivePhaseId}
      />
      <FileTable
        projectId={id}
        activePhaseId={activePhaseId}
        phaseFiles={phaseFiles}
        onDownload={handleDownload}
        onRefresh={refreshAttachments}
        uploadTriggerRef={uploadTriggerRef}
      />
      {activePhaseId && (
        <div className="px-6 py-4">
          <TaskSection
            projectId={id}
            activePhaseId={activePhaseId}
            highlightTaskId={highlightTaskId}
            phases={project.phases.map((p: { id: string; name: string }) => ({
              id: p.id,
              name: p.name,
            }))}
            members={project.members.map(
              (m: { user_id: string; name: string; email: string }) => ({
                user_id: m.user_id,
                user_name: m.name,
                user_email: m.email,
              })
            )}
          />
        </div>
      )}
      <CommentsSection
        comments={comments}
        newComment={newComment}
        onNewCommentChange={setNewComment}
        sendingComment={sendingComment}
        onSendComment={handleSendComment}
      />
    </div>
  );
}
