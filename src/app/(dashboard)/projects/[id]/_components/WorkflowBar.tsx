"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowSteps } from "@/components/project/WorkflowSteps";
import type { DbStep } from "@/types";

interface WorkflowBarProps {
  projectId: string;
  steps?: DbStep[];
}

/**
 *
 */
export function WorkflowBar({ projectId, steps }: WorkflowBarProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  return (
    <div className="flex items-center justify-between px-10 py-4 border-b border-[#333333]">
      {steps && steps.length > 0 ? (
        <WorkflowSteps steps={steps} />
      ) : (
        <WorkflowSteps
          steps={[
            { id: "1", name: "Recce", step_order: 1, status: "completed" },
            { id: "2", name: "Design", step_order: 2, status: "in_progress" },
            { id: "3", name: "BOQ", step_order: 3, status: "pending" },
            { id: "4", name: "Order", step_order: 4, status: "pending" },
            {
              id: "5",
              name: "Work Progress",
              step_order: 5,
              status: "pending",
            },
            { id: "6", name: "Snag", step_order: 6, status: "pending" },
            { id: "7", name: "Finance", step_order: 7, status: "pending" },
          ]}
        />
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="!text-xs"
          onClick={() => router.push(`/projects/${projectId}/edit`)}
        >
          <Edit className="w-3.5 h-3.5" />
          {t("designReview") || "Design Review"}
        </Button>
        <Button
          className="!text-xs !bg-[#EF4444] !text-white hover:!bg-[#DC2626]"
          onClick={() => router.push(`/projects/${projectId}/upload`)}
        >
          {t("actionsButton") || "Actions"}
        </Button>
      </div>
    </div>
  );
}
