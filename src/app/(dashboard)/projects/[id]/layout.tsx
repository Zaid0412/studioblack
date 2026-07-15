"use client";

import { use, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUserRole } from "@/hooks/useUserRole";
import {
  UserRoleProvider,
  useUserRoleContext,
} from "@/contexts/UserRoleContext";
import { useFlag } from "@/hooks/useFlag";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { ArrowRight, Settings } from "lucide-react";
import { ProjectHeader } from "./_components/ProjectHeader";
import { MetaBar } from "./_components/MetaBar";
import { CommentsSection } from "./_components/CommentsSection";
import { ProjectWorkflowSteps } from "./_components/ProjectWorkflowSteps";
import { DEFAULT_BOQ_SEGMENT } from "./boq/_lib/tabs";
import { DEFAULT_ORDER_SEGMENT } from "./order/_lib/tabs";
import type { DbMember } from "@/types";

/**
 * Shared chrome for every project sub-route — header, meta bar, and the
 * comments section pinned below tab content. The active tab page (Design
 * / BOQ Scope / future) renders as `children`.
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
  const tpd = useTranslations("projectDetail");
  const { role, loading: roleLoading } = useUserRole();
  const ctx = useUserRoleContext();
  const isClient = role === "client";
  const boqEnabled = useFlag("boq");
  const pathname = usePathname();

  const {
    project,
    comments,
    initialLoading,
    error,
    phaseCounts,
    submitComment,
    refreshAll,
  } = useProjectDetail(id, { includeApprovals: isClient });

  // Project-scoped PM authority: when the current user is an architect with a
  // `project_member.role='pm'` row on this project, override the role context
  // for everything rendered inside this layout. Sidebar/notifications/global
  // surfaces stay on their original role because they're siblings of this
  // provider in the dashboard tree.
  const projectScopedRole = useMemo(() => {
    if (!ctx || !project?.members) return role;
    if (role !== "architect") return role;
    const isProjectPm = project.members.some(
      (m: DbMember) => m.user_id === ctx.userId && m.role === "pm"
    );
    return isProjectPm ? "pm" : role;
  }, [ctx, project?.members, role]);

  const base = `/projects/${id}`;

  // The stepper sits in the shared layout so switching between Design /
  // BOQ / Order doesn't unmount it. Clients see the same nav because PR-2
  // surfaces BOQ items at `sent_to_client+` to them — without the stepper
  // they would have no tab switcher. On BOQ side only visible on the
  // my-scope sub-tab; on Order side only on the RFQ list (detail pages
  // render their own header). Documents is a separate surface entered via
  // MetaBar — no stepper there.
  const showWorkflowSteps =
    boqEnabled &&
    (pathname === `${base}/designs` ||
      pathname === `${base}/boq/${DEFAULT_BOQ_SEGMENT}` ||
      pathname === `${base}/order/${DEFAULT_ORDER_SEGMENT}`);

  // ProjectHeader shows on every project surface that has the standard chrome
  // (overview, designs, BoQ, Order — including /order/rfq — and documents).
  // Upload, review, and edit render their own chrome.
  const showHeader =
    pathname === base ||
    pathname.startsWith(`${base}/designs`) ||
    pathname.startsWith(`${base}/documents`) ||
    pathname.startsWith(`${base}/boq`) ||
    pathname.startsWith(`${base}/order`);

  // Surfaces that carry the project info card + comments strip: everything with
  // the standard header except the documents file list (needs the height).
  const metaSurface = showHeader && !pathname.startsWith(`${base}/documents`);

  // RFQ create/detail pages (`/order/rfq/<id>`, `/order/rfq/new`) carry their
  // own focused header + full-height form, so the project chrome (info card,
  // comments strip) is suppressed there — but kept on the RFQ list
  // (`/order/rfq`).
  const onRfqSubpage = pathname.startsWith(`${base}/order/rfq/`);

  // MetaBar is the project info card.
  const showMetaBar = metaSurface && !onRfqSubpage;

  // The project comments strip is only relevant on design/BOQ surfaces —
  // documents has its own context, and the RFQ create/detail forms would
  // collide with it (it renders below a full-height form), so both are excluded.
  const showComments = metaSurface && !onRfqSubpage;

  // Gate on the primary resource only: once the project lands, keep rendering
  // the chrome even while a secondary one (comments, phase-counts) revalidates
  // — otherwise navigating back in (e.g. from a design review) re-flashes the
  // whole skeleton.
  if (initialLoading || roleLoading) {
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

  const onDocuments = pathname.startsWith(`${base}/documents`);

  // Shared style for the header-action pills (Edit Project, Documents).
  const pillClass =
    "inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border-default bg-bg-elevated text-[13px] font-medium text-text-primary hover:bg-bg-input hover:border-text-muted/40 transition-colors";

  // Right-side pill that takes the user to /documents. Hidden on /documents
  // itself (the back-pill in the breadcrumb covers the round-trip).
  const documentsAction = !onDocuments ? (
    <Link href={`${base}/documents`} className={`group ${pillClass}`}>
      <span>Documents</span>
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  ) : null;

  // Settings (project details + BOQ config) lives in the shared header so it's
  // reachable from every tab (Design / BOQ / Order), not just Design. Gated on
  // the project-scoped role so an architect with a `project_member.role='pm'`
  // row sees it too.
  const settingsAction =
    projectScopedRole === "pm" ? (
      <Link href={`${base}/settings`} className={pillClass}>
        <Settings className="w-3.5 h-3.5" />
        <span>{tpd("settings") || "Settings"}</span>
      </Link>
    ) : null;

  const headerActions = (
    <>
      {settingsAction}
      {documentsAction}
    </>
  );

  const tree = (
    <div className="flex flex-col h-full">
      {showHeader && (
        <ProjectHeader
          projectName={project.name}
          projectNumber={project.project_number}
          description={undefined}
          onRefresh={refreshAll}
          actions={headerActions}
          projectHref={onDocuments ? base : undefined}
          subSection={onDocuments ? "Documents" : undefined}
        />
      )}

      {showMetaBar && (
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
      )}

      {showWorkflowSteps && (
        <ProjectWorkflowSteps
          projectId={id}
          phaseCounts={phaseCounts}
          showBoq={boqEnabled}
          disabledStepNames={(project?.steps ?? [])
            .filter((s) => !s.enabled)
            .map((s) => s.name)}
        />
      )}

      {children}

      {showComments && (
        <>
          <div className="mx-4 lg:mx-10 border-t border-border-default mt-2 mb-8" />
          <CommentsSection comments={comments} submitComment={submitComment} />
        </>
      )}
    </div>
  );

  // Only wrap when we actually changed the role — keeps the existing dashboard
  // provider as the single source of truth for everyone else.
  if (ctx && projectScopedRole && projectScopedRole !== ctx.role) {
    return (
      <UserRoleProvider
        role={projectScopedRole}
        userId={ctx.userId}
        orgRole={ctx.orgRole}
      >
        {tree}
      </UserRoleProvider>
    );
  }
  return tree;
}
