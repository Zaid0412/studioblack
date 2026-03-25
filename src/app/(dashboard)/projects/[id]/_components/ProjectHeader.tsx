"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshButton } from "@/components/ui/RefreshButton";

interface ProjectHeaderProps {
  projectName: string;
  /** Optional description shown below the project name. */
  description?: string;
  onRefresh?: () => void | Promise<void>;
  /** Path for the "back to projects" breadcrumb link. Defaults to "/projects". */
  backPath?: string;
  /** Extra content rendered in the top-right area (e.g. approval buttons). */
  actions?: React.ReactNode;
}

/** Project detail page header with breadcrumb and project name. */
export function ProjectHeader({
  projectName,
  description,
  onRefresh,
  backPath = "/projects",
  actions,
}: ProjectHeaderProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between px-4 lg:px-10 py-5 border-b border-[#333333] gap-3">
      <div className="min-w-0">
        <span className="text-[13px] text-[#666666]">
          <button
            onClick={() => router.push(backPath)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            {t("breadcrumbProjects") || "Projects"}
          </button>
          {" / "}
          <span className="truncate">{projectName}</span>
        </span>
        <h1 className="text-xl lg:text-[26px] font-bold text-white font-[family-name:var(--font-cabinet)] mt-1 truncate">
          {projectName}
        </h1>
        {description && (
          <p className="text-[13px] text-[#A0A0A0] mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {actions}
        {onRefresh && <RefreshButton onRefresh={onRefresh} />}
      </div>
    </div>
  );
}
