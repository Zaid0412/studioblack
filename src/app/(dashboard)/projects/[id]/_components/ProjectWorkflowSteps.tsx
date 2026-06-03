"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useBoq } from "@/hooks/useBoq";
import { useRfqList } from "@/hooks/useRfqs";
import { DEFAULT_BOQ_SEGMENT } from "../boq/_lib/tabs";
import { DEFAULT_ORDER_SEGMENT } from "../order/_lib/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { isStudioUser } from "@/lib/roles";
import { useActiveProjectTab, type ProjectTab } from "./ProjectTabs";

type StepStatus = "pending" | "in_progress" | "completed";

interface StepDef {
  id: ProjectTab;
  name: string;
  status: StepStatus;
  href: string;
}

interface ProjectWorkflowStepsProps {
  projectId: string;
  /** Per-phase attachment counts — Design status is `pending` when this is empty. */
  phaseCounts: Map<string, number>;
  /** Hide the BOQ + Order steps (e.g. for clients or when the feature is off). */
  showBoq: boolean;
}

const STATUS_DOT: Record<StepStatus, string> = {
  completed: "bg-success",
  in_progress: "bg-warning",
  pending: "bg-border-default",
};

/**
 * Breadcrumb-style step bar that doubles as project tab navigation.
 * Only "Design", "BOQ", and "Order" are live; the other lifecycle stages
 * are hidden until they're wired up. The Order step is studio-only —
 * clients and vendors don't see procurement.
 *
 * Two independent visual signals:
 *   - dot colour  → grey (not started) / yellow (in progress) / green (approved)
 *   - active tab  → accent-colored, bold label
 */
export function ProjectWorkflowSteps({
  projectId,
  phaseCounts,
  showBoq,
}: ProjectWorkflowStepsProps) {
  const activeTab = useActiveProjectTab(projectId);
  const { boq, notFound } = useBoq(projectId);
  const { role } = useUserRole();
  const isStudio = isStudioUser(role);
  const showOrder = showBoq && isStudio;

  // RFQ-count probe for the Order dot. Skipped for non-studio viewers (the
  // API 403s them) and when the Order step is hidden anyway. limit=1 to
  // keep the payload small — the underlying COUNT(*) OVER () still walks
  // the row set, acceptable for a single probe; revisit with a dedicated
  // count endpoint if RFQ tables grow large.
  const { total: rfqTotal } = useRfqList(
    projectId,
    { page: 1, limit: 1 },
    { enabled: showOrder }
  );

  // TODO: mark Design as "completed" when all design files across all phases
  // are approved. Needs project-wide attachment status — not on the detail
  // payload today.
  const designStatus: StepStatus =
    phaseCounts.size === 0 ? "pending" : "in_progress";

  // BOQ step is "completed" when every item is at the terminal phase.
  // Empty BOQ counts as in-progress so the indicator nudges the team to
  // start filling it. Notfound = pending (no BOQ yet).
  //
  // Note: for client viewers, `boq.items` is already filtered server-side
  // to client-visible phases. So a client whose items are all `client_approved`
  // sees the green "completed" dot even when the studio still has items in
  // `draft` for the same BOQ. That's intentional — from the client's POV
  // every item they care about IS approved — but it means the same dot can
  // show different states to different viewers of the same BOQ.
  const boqStatus: StepStatus = notFound
    ? "pending"
    : boq &&
        boq.items.length > 0 &&
        boq.items.every((it) => it.phase === "client_approved")
      ? "completed"
      : "in_progress";

  // Order step: `pending` until any RFQ exists, then `in_progress`. No
  // terminal state defined yet — flip to `completed` once procurement has
  // a clear end signal (e.g. all RFQs awarded).
  const orderStatus: StepStatus = rfqTotal > 0 ? "in_progress" : "pending";

  const steps: StepDef[] = [
    {
      id: "designs",
      name: "Design",
      status: designStatus,
      href: `/projects/${projectId}/designs`,
    },
  ];
  if (showBoq) {
    // Link straight to the first visible sub-tab so we skip the
    // intermediate /boq → /boq/my-scope redirect on every click. The
    // /boq route still redirects for bookmarks and external links.
    steps.push({
      id: "boq",
      name: "BOQ",
      status: boqStatus,
      href: `/projects/${projectId}/boq/${DEFAULT_BOQ_SEGMENT}`,
    });
    if (showOrder) {
      steps.push({
        id: "order",
        name: "Order",
        status: orderStatus,
        href: `/projects/${projectId}/order/${DEFAULT_ORDER_SEGMENT}`,
      });
    }
  }

  return (
    <div className="px-4 lg:px-10 py-6 border-b border-border-default">
      <div className="relative overflow-x-auto scrollbar-none">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 lg:hidden" />
        <div className="flex items-center gap-5">
          {steps.map((step, i) => {
            const isActive = step.id === activeTab;
            return (
              <div key={step.id} className="flex items-center gap-5">
                <Link
                  href={step.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    isActive
                      ? "bg-accent/10"
                      : "hover:bg-bg-elevated hover:text-text-primary"
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full ${STATUS_DOT[step.status]}`}
                  />
                  <span
                    className={`text-base transition-colors ${
                      isActive
                        ? "font-semibold text-accent"
                        : "font-medium text-text-muted"
                    }`}
                  >
                    {step.name}
                  </span>
                </Link>
                {i < steps.length - 1 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-5 w-5 text-text-muted/60"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
