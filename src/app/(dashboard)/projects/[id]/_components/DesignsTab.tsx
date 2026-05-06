"use client";

import { useRef } from "react";
import type {
  DbApproval,
  DbAttachment,
  DbPendingTask,
  DbProjectDetail,
  UserRole,
} from "@/types";
import { WorkflowBar } from "./WorkflowBar";
import { PhaseTabs } from "./PhaseTabs";
import { FileTable } from "./FileTable";
import { TaskSection } from "./TaskSection";
import { PendingTasksBanner } from "./PendingTasksBanner";
import { CompletedBanner } from "./CompletedBanner";
import { ApprovalHistory } from "./ApprovalHistory";
import type { ProjectTab } from "./ProjectTabs";

interface DesignsTabProps {
  projectId: string;
  project: DbProjectDetail;
  role: UserRole | null;
  currentUserId: string | undefined;
  activeTab: ProjectTab;
  activePhaseId: string | null;
  setActivePhaseId: (id: string) => void;
  phaseCounts: Map<string, number>;
  phaseFiles: DbAttachment[];
  pendingTasks: DbPendingTask[];
  approvals: DbApproval[];
  reviewingTaskId: string | null;
  handleTaskReview: (
    taskId: string,
    action: "approved" | "changes_requested",
    comment?: string
  ) => void | Promise<void>;
  handleDownload: (att: DbAttachment) => void | Promise<void>;
  refreshAttachments: () => void;
  highlightTaskId: string | null;
}

/**
 * "Designs" tab of the project detail page — phases, files, tasks,
 * approvals. Extracted from the old monolithic project page so the BOQ
 * tab can live alongside it.
 */
export function DesignsTab({
  projectId,
  project,
  role,
  currentUserId,
  activeTab,
  activePhaseId,
  setActivePhaseId,
  phaseCounts,
  phaseFiles,
  pendingTasks,
  approvals,
  reviewingTaskId,
  handleTaskReview,
  handleDownload,
  refreshAttachments,
  highlightTaskId,
}: DesignsTabProps) {
  const isClient = role === "client";
  const uploadTriggerRef = useRef<(() => void) | null>(null);

  return (
    <>
      {role === "pm" && (
        <WorkflowBar
          projectId={projectId}
          activeTab={activeTab}
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
        projectId={projectId}
        activePhaseId={activePhaseId}
        phaseFiles={phaseFiles}
        onDownload={handleDownload}
        onRefresh={refreshAttachments}
        readOnly={isClient}
        uploadTriggerRef={isClient ? undefined : uploadTriggerRef}
        userRole={role}
        currentUserId={currentUserId}
      />

      {!isClient && activePhaseId && (
        <div className="px-4 lg:px-6 py-4">
          <TaskSection
            projectId={projectId}
            activePhaseId={activePhaseId}
            highlightTaskId={highlightTaskId}
          />
        </div>
      )}

      {isClient && <ApprovalHistory approvals={approvals} />}
    </>
  );
}
