"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkflowBarProps {
  projectId: string;
  onUpload?: () => void;
}

/**
 * Upload Designs action bar for the Design tab. Edit Project moved to the
 * shared ProjectHeader so it's reachable from every tab.
 */
export function WorkflowBar({ projectId, onUpload }: WorkflowBarProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  return (
    <div className="px-4 lg:px-10 py-4">
      <div className="flex items-center justify-end border-b border-border-default pb-4 gap-3">
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
