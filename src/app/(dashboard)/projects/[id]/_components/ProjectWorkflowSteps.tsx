"use client";

import { WorkflowSteps } from "@/components/project/WorkflowSteps";
import type { DbStep } from "@/types";

interface Props {
  steps?: DbStep[];
}

// Placeholder until the project_step table is wired into the detail query.
const DEFAULT_STEPS: DbStep[] = [
  { id: "1", name: "Recce", step_order: 1, status: "completed" },
  { id: "2", name: "Design", step_order: 2, status: "in_progress" },
  { id: "3", name: "BOQ", step_order: 3, status: "pending" },
  { id: "4", name: "Order", step_order: 4, status: "pending" },
  { id: "5", name: "Work Progress", step_order: 5, status: "pending" },
  { id: "6", name: "Snag", step_order: 6, status: "pending" },
  { id: "7", name: "Finance", step_order: 7, status: "pending" },
];

/**
 * Horizontal workflow-steps strip rendered above the project tabs. Scrolls
 * horizontally on small screens with a right-edge fade hint.
 */
export function ProjectWorkflowSteps({ steps }: Props) {
  return (
    <div className="px-4 lg:px-10 py-4 border-b border-border-default">
      <div className="relative overflow-x-auto scrollbar-none">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 lg:hidden" />
        <WorkflowSteps steps={steps ?? DEFAULT_STEPS} />
      </div>
    </div>
  );
}
