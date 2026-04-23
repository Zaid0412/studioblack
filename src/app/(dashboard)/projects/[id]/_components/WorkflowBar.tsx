"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Edit, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectTab } from "./ProjectTabs";

interface WorkflowBarProps {
  projectId: string;
  activeTab?: ProjectTab;
  onUpload?: () => void;
}

/**
 * Action bar for the project detail page. Behaviour branches on `activeTab`:
 * - "designs" (default): Edit Project + Upload Designs buttons
 * - "boq": renders nothing — the BOQ tab has its own action bar (Task 5D)
 *
 * Note: the workflow-steps strip lives in `page.tsx` so it can span all
 * tabs. This component owns the designs-only actions.
 */
export function WorkflowBar({
  projectId,
  activeTab = "designs",
  onUpload,
}: WorkflowBarProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  if (activeTab === "boq") return null;

  return (
    <div className="px-4 lg:px-10 py-4">
      <div className="flex items-center justify-end border-b border-border-default pb-4 gap-3">
        <Button
          variant="secondary"
          className="!text-xs"
          onClick={() => router.push(`/projects/${projectId}/edit`)}
        >
          <Edit className="w-3.5 h-3.5" />
          {t("editProject") || "Edit Project"}
        </Button>
        <Button
          className="!text-xs"
          onClick={() =>
            onUpload ? onUpload() : router.push(`/projects/${projectId}/upload`)
          }
        >
          <Upload className="w-3.5 h-3.5" />
          {t("actionsButton") || "Upload Designs"}
        </Button>
      </div>
    </div>
  );
}
