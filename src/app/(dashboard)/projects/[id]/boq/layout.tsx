"use client";

import { use } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { WorkflowSubTabStrip } from "@/components/projects/WorkflowSubTabStrip";
import { tabsForRole } from "./_lib/tabs";

/**
 * BOQ container layout — sub-tab strip + active sub-tab content. The
 * project workflow stepper lives in the parent project layout so it
 * stays mounted when switching between Design and BOQ.
 */
export default function BoqLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);
  const { role } = useUserRole();
  const tabs = tabsForRole(role);

  return (
    <>
      <WorkflowSubTabStrip
        basePath={`/projects/${id}/boq`}
        tabs={tabs}
        i18nNamespace="boq.tabs"
      />
      {children}
    </>
  );
}
