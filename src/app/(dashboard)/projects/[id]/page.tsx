"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useProjectDetail } from "./_hooks/use-project-detail";
import { ProjectHeader } from "./_components/project-header";
import { MetaBar } from "./_components/meta-bar";
import { WorkflowBar } from "./_components/workflow-bar";
import { PhaseTabs } from "./_components/phase-tabs";
import { FileTable } from "./_components/file-table";
import { CommentsSection } from "./_components/comments-section";

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
  } = useProjectDetail(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-full">
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
      <ProjectHeader projectName={project.name} />
      <MetaBar
        clientName={project.client_name}
        clientEmail={project.client_email}
        members={project.members}
        createdAt={project.created_at}
        phases={project.phases}
        phaseCounts={phaseCounts}
      />
      <WorkflowBar projectId={id} steps={project.steps} />
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
      />
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
