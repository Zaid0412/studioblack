"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface ProjectHeaderProps {
  projectName: string;
}

/** Project detail page header with breadcrumb and project name. */
export function ProjectHeader({ projectName }: ProjectHeaderProps) {
  const router = useRouter();
  const t = useTranslations("projectDetail");

  return (
    <div className="px-10 py-5 border-b border-[#333333]">
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
  );
}
