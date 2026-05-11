"use client";

import { use } from "react";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useUserRole } from "@/hooks/useUserRole";
import { BoqTab } from "../../_components/BoqTab";

/**
 * BOQ → Scope tab. The workflow stepper above this and the BOQ
 * sub-tab strip both live in `boq/layout.tsx`; this page just renders
 * the BOQ surface itself.
 */
export default function BoqMyScopePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { role } = useUserRole();
  const isClient = role === "client";
  const { project } = useProjectDetail(id, { includeApprovals: isClient });

  if (!project) return null;

  return <BoqTab projectId={id} projectName={project.name} />;
}
