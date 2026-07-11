"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
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
  /**
   * When set, the project-name breadcrumb segment becomes a clickable link to
   * this href. Used to provide a "go back" out of sub-routes like /documents
   * without a separate back button. Leave undefined on the project root page.
   */
  projectHref?: string;
  /** Trailing breadcrumb segment, e.g. "Documents" on /projects/[id]/documents. */
  subSection?: string;
}

/** Project detail page header with breadcrumb and project name. */
export function ProjectHeader({
  projectName,
  description,
  onRefresh,
  backPath = "/projects",
  actions,
  projectHref,
  subSection,
}: ProjectHeaderProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between px-4 lg:px-10 py-5 border-b border-border-default gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
      <div className="min-w-0">
        {projectHref ? (
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => router.push(projectHref)}
              className="inline-flex items-center gap-1 -ml-1 px-1.5 py-0.5 rounded-md text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
              aria-label={`Back to ${projectName}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="truncate max-w-[260px]">{projectName}</span>
            </button>
            {subSection && (
              <span className="text-[13px] text-text-muted">
                / <span className="text-text-primary">{subSection}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-text-secondary font-medium">
            <button
              onClick={() => router.push(backPath)}
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              {t("breadcrumbProjects") || "Projects"}
            </button>
            {" / "}
            <span className="truncate">{projectName}</span>
          </span>
        )}
        <div className="flex items-center justify-between gap-3 mt-1">
          <h1 className="text-xl lg:text-[26px] font-bold text-text-primary font-[family-name:var(--font-cabinet)] truncate">
            {projectName}
          </h1>
          {onRefresh && (
            <div className="shrink-0 lg:hidden">
              <RefreshButton onRefresh={onRefresh} />
            </div>
          )}
        </div>
        {description && (
          <p className="text-[13px] text-text-secondary mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {actions}
        {onRefresh && (
          <div className="hidden lg:block">
            <RefreshButton onRefresh={onRefresh} />
          </div>
        )}
      </div>
    </div>
  );
}
