"use client";

import { use } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { WorkflowSubTabStrip } from "@/components/projects/WorkflowSubTabStrip";
import { orderTabsForRole } from "./_lib/tabs";

/**
 * Order container layout — sub-tab strip + active sub-tab content. The
 * project workflow stepper lives in the parent project layout so it
 * stays mounted when switching between Design / BOQ / Order.
 */
export default function OrderLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);
  const { role } = useUserRole();
  const tabs = orderTabsForRole(role);

  return (
    <>
      <WorkflowSubTabStrip
        basePath={`/projects/${id}/order`}
        tabs={tabs}
        i18nNamespace="order.tabs"
      />
      {children}
    </>
  );
}
