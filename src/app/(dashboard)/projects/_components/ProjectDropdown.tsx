"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MoreVertical, Eye, Edit, Upload, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { DbProjectRow } from "@/types";

/** Reusable dropdown menu for project actions. */
export function ProjectDropdown({
  project,
  isStaff,
  isPm,
  onDelete,
}: {
  project: DbProjectRow;
  isStaff: boolean;
  isPm: boolean;
  onDelete: (project: DbProjectRow) => void;
}) {
  const t = useTranslations("projects");
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors cursor-pointer shrink-0"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/projects/${project.id}`);
          }}
        >
          <Eye className="w-4 h-4" />
          {t("viewProject")}
        </DropdownMenuItem>
        {isPm && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/projects/${project.id}/edit`);
            }}
          >
            <Edit className="w-4 h-4" />
            {t("editProject")}
          </DropdownMenuItem>
        )}
        {isStaff && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/projects/${project.id}/upload`);
            }}
          >
            <Upload className="w-4 h-4" />
            {t("uploadDesign")}
          </DropdownMenuItem>
        )}
        {isPm && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project);
              }}
            >
              <Trash2 className="w-4 h-4" />
              {t("deleteProject")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
