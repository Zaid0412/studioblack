"use client";

import { use, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { tasks } from "@/lib/api";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { ProjectHeader } from "./_components/ProjectHeader";
import { MetaBar } from "./_components/MetaBar";
import { WorkflowBar } from "./_components/WorkflowBar";
import { PhaseTabs } from "./_components/PhaseTabs";
import { FileTable } from "./_components/FileTable";
import { TaskSection } from "./_components/TaskSection";
import { CommentsSection } from "./_components/CommentsSection";
import { PendingTasksBanner } from "./_components/PendingTasksBanner";
import { CompletedBanner } from "./_components/CompletedBanner";
import { ApprovalHistory } from "./_components/ApprovalHistory";

/** Unified project detail page — adapts to PM, architect, or client role. */
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tc = useTranslations("common");
  const { role, session, loading: roleLoading } = useUserRole();
  const isClient = role === "client";

  const {
    project,
    attachments,
    comments,
    approvals,
    pendingTasks,
    newComment,
    setNewComment,
    sendingComment,
    loading,
    error,
    activePhaseId,
    setActivePhaseId,
    phaseCounts,
    phaseFiles,
    handleSendComment,
    handleDownload,
    refreshAttachments,
    refreshAll,
    reviewingTaskId,
    handleTaskReview,
  } = useProjectDetail(id, { includeApprovals: isClient });

  const uploadTriggerRef = useRef<(() => void) | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightTaskId = searchParams.get("highlightTask");

  useEffect(() => {
    if (!highlightTaskId || !project) return;
    tasks
      .get(highlightTaskId)
      .then((task) => {
        if (task?.phase_id) setActivePhaseId(task.phase_id);
      })
      .catch(() => {})
      .finally(() => {
        // Clean up URL param after consuming it
        const params = new URLSearchParams(searchParams.toString());
        params.delete("highlightTask");
        router.replace(
          `${window.location.pathname}${params.size ? `?${params}` : ""}`,
          { scroll: false }
        );
      });
  }, [highlightTaskId, project, setActivePhaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || roleLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header skeleton */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-border-default">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        {/* Meta bar skeleton */}
        <div className="flex flex-wrap gap-4 px-4 lg:px-6 py-3 border-b border-border-default">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-28" />
          ))}
        </div>
        {/* Phase tabs skeleton */}
        <div className="flex gap-2 px-4 lg:px-6 py-3 border-b border-border-default">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32 rounded-lg" />
          ))}
        </div>
        {/* File table skeleton */}
        <div className="px-4 lg:px-6 py-4 flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border-default"
            >
              <Skeleton className="w-8 h-8 rounded" />
              <div className="flex flex-col gap-1 flex-1">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-text-muted">{tc("projectNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader
        projectName={project.name}
        description={undefined}
        onRefresh={refreshAll}
      />

      <MetaBar
        variant={isClient ? "client" : "pm"}
        clientName={project.client_name}
        clientEmail={project.client_email}
        members={project.members}
        createdAt={project.created_at}
        phases={project.phases}
        phaseCounts={phaseCounts}
        status={project.status}
        category={project.category}
        deadline={project.deadline}
        scope={project.scope}
        areaSqft={project.area_sqft}
        estimationInr={project.estimation_inr}
        address={project.address}
        city={project.city}
        state={project.state}
      />

      {role === "pm" && (
        <WorkflowBar
          projectId={id}
          onUpload={() => uploadTriggerRef.current?.()}
        />
      )}

      {isClient && (
        <PendingTasksBanner
          pendingTasks={pendingTasks}
          reviewingTaskId={reviewingTaskId}
          onTaskReview={handleTaskReview}
        />
      )}

      {isClient && project.status === "completed" && <CompletedBanner />}

      <PhaseTabs
        phases={project.phases}
        activePhaseId={activePhaseId}
        phaseCounts={phaseCounts}
        onPhaseChange={setActivePhaseId}
        showPhaseStatus
      />

      <FileTable
        projectId={id}
        activePhaseId={activePhaseId}
        phaseFiles={phaseFiles}
        onDownload={handleDownload}
        onRefresh={refreshAttachments}
        readOnly={isClient}
        uploadTriggerRef={isClient ? undefined : uploadTriggerRef}
        userRole={role}
        currentUserId={session?.user?.id}
      />

      {!isClient && activePhaseId && (
        <div className="px-4 lg:px-6 py-4">
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

      {isClient && <ApprovalHistory approvals={approvals} />}

      {/* Separator between tasks/files and comments */}
      <div className="mx-4 lg:mx-10 border-t border-border-default mt-2 mb-8" />

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
