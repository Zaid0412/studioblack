"use client";

import { use } from "react";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useFlag } from "@/hooks/useFlag";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { ProjectWorkflowSteps } from "../_components/ProjectWorkflowSteps";
import { BoqSubTabStrip } from "./_components/BoqSubTabStrip";

/**
 * BOQ container layout. Renders, in order:
 *   1. The project workflow stepper (only on `/my-scope` per the
 *      product decision — other BOQ sub-tabs render their own header).
 *   2. The BOQ sub-tab strip (always — driven by `VISIBLE_BOQ_TABS`).
 *   3. Active sub-tab content (`children`).
 */
export default function BoqLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const isMyScope = pathname === `/projects/${id}/boq/my-scope`;

  const { role } = useUserRole();
  const isClient = role === "client";
  const boqEnabled = useFlag("boq");
  const showWorkflowSteps = isMyScope && !isClient && boqEnabled;

  // Total file count drives the Design status dot in the stepper.
  const { phaseCounts } = useProjectDetail(id, {
    includeApprovals: isClient,
  });

  return (
    <>
      {showWorkflowSteps && (
        <ProjectWorkflowSteps
          projectId={id}
          fileCount={Array.from(phaseCounts.values()).reduce(
            (sum, n) => sum + n,
            0
          )}
          showBoq={!isClient && boqEnabled}
        />
      )}
      <BoqSubTabStrip projectId={id} />
      {children}
    </>
  );
}
