"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshButton } from "@/components/ui/RefreshButton";

interface ProjectHeaderProps {
  projectName: string;
  onRefresh?: () => void | Promise<void>;
}

/** Project detail page header with breadcrumb and project name. */
export function ProjectHeader({ projectName, onRefresh }: ProjectHeaderProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  return (
    <div className="flex items-start justify-between px-10 py-5 border-b border-[#333333]">
      <div>
        <span className="text-[13px] text-[#666666]">
          <button
            onClick={() => router.push("/projects")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            {t("breadcrumbProjects") || "Projects"}
          </button>
          {" / "}
          {projectName}
        </span>
        <h1 className="text-[26px] font-bold text-white font-[family-name:var(--font-cabinet)] mt-1">
          {projectName}
        </h1>
      </div>
      {onRefresh && <RefreshButton onRefresh={onRefresh} />}
    </div>
  );
}
