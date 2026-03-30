"use client";

import { use, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { tasks } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useUserRole } from "@/hooks/useUserRole";
import { ProjectHeader } from "./_components/ProjectHeader";
import { MetaBar } from "./_components/MetaBar";
import { WorkflowBar } from "./_components/WorkflowBar";
import { PhaseTabs } from "./_components/PhaseTabs";
import { FileTable } from "./_components/FileTable";
import { TaskSection } from "./_components/TaskSection";
import { CommentsSection } from "./_components/CommentsSection";
import { ApprovalButtons } from "./_components/ApprovalButtons";
import { PendingTasksBanner } from "./_components/PendingTasksBanner";
import { CompletedBanner } from "./_components/CompletedBanner";
import { ApprovalHistory } from "./_components/ApprovalHistory";
import { RequestChangesDialog } from "./_components/RequestChangesDialog";

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
    submittingDecision,
    handleDecision,
    changesDialogOpen,
    setChangesDialogOpen,
    changesComment,
    setChangesComment,
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
        router.replace(`${window.location.pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
      });
  }, [highlightTaskId, project, setActivePhaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || roleLoading) {
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

  const showApprovalButtons =
    isClient &&
    project.status !== "completed" &&
    pendingTasks.length === 0 &&
    attachments.length > 0;

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader
        projectName={project.name}
        description={undefined}
        onRefresh={!isClient ? refreshAll : undefined}
        actions={
          showApprovalButtons ? (
            <ApprovalButtons
              submittingDecision={submittingDecision}
              onApprove={() => handleDecision("approved")}
              onRequestChanges={() => setChangesDialogOpen(true)}
            />
          ) : undefined
        }
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

      {!isClient && (
        <WorkflowBar
          projectId={id}
          steps={project.steps}
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
        showPhaseStatus={isClient}
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
      <div className="mx-4 lg:mx-10 border-t border-[#333333] mt-2 mb-8" />

      <CommentsSection
        comments={comments}
        newComment={newComment}
        onNewCommentChange={setNewComment}
        sendingComment={sendingComment}
        onSendComment={handleSendComment}
      />

      {isClient && (
        <RequestChangesDialog
          open={changesDialogOpen}
          onOpenChange={setChangesDialogOpen}
          comment={changesComment}
          onCommentChange={setChangesComment}
          submitting={submittingDecision}
          onSubmit={async () => {
            await handleDecision("changes_requested", changesComment);
            setChangesDialogOpen(false);
            setChangesComment("");
          }}
        />
      )}
    </div>
  );
}
