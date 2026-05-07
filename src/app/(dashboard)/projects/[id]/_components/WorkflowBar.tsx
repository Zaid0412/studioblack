"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Edit, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkflowBarProps {
  projectId: string;
  onUpload?: () => void;
}

/** Edit Project + Upload Designs action bar for the Design tab. */
export function WorkflowBar({ projectId, onUpload }: WorkflowBarProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

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
