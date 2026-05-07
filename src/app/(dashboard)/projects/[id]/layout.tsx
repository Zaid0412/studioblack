"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProjectHeader } from "./_components/ProjectHeader";
import { MetaBar } from "./_components/MetaBar";
import { CommentsSection } from "./_components/CommentsSection";

/**
 * Shared chrome for every project sub-route — header, meta bar, and the
 * comments section pinned below tab content. The active tab page (Design
 * / BOQ My Scope / future) renders as `children`.
 *
 * `useProjectDetail` is called both here and in child pages — SWR
 * dedupes the network calls, and the local UI state (`activePhaseId`,
 * `newComment`) only matters in the place that consumes it (DesignsTab,
 * CommentsSection respectively), so no shared-state plumbing is needed.
 */
export default function ProjectDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);
  const tc = useTranslations("common");
  const { role, loading: roleLoading } = useUserRole();
  const isClient = role === "client";

  const {
    project,
    comments,
    newComment,
    setNewComment,
    sendingComment,
    loading,
    error,
    phaseCounts,
    handleSendComment,
    refreshAll,
  } = useProjectDetail(id, { includeApprovals: isClient });

  if (loading || roleLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-border-default">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-4 px-4 lg:px-6 py-3 border-b border-border-default">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-28" />
          ))}
        </div>
        <div className="flex gap-2 px-4 lg:px-6 py-3 border-b border-border-default">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32 rounded-lg" />
          ))}
        </div>
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

      {children}

      {/* Separator between tab content and comments */}
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
