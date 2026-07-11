"use client";

import { Calendar } from "lucide-react";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import type { DbProjectRow } from "@/types";
import { relativeTime } from "@/lib/formatTime";
import { formatShortDate } from "@/lib/formatDate";
import { ProjectDropdown } from "./ProjectDropdown";

/** Shared card used by grid (desktop) and mobile list views. */
export function ProjectCard({
  project,
  variant,
  isStaff,
  isPm,
  onDelete,
  onClick,
}: {
  project: DbProjectRow;
  variant: "grid" | "mobile";
  isStaff: boolean;
  isPm: boolean;
  onDelete: (project: DbProjectRow) => void;
  onClick: () => void;
}) {
  const clientDisplay = project.client_name || project.client_email;

  if (variant === "mobile") {
    return (
      <div
        data-anim-item
        className="flex flex-col gap-2 p-4 border-b border-border-default last:border-b-0 active:bg-bg-elevated/50 transition-colors cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-text-primary truncate">
            {project.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={statusToBadgeVariant(project.status)}>
              <span className="capitalize">{project.status}</span>
            </Badge>
            <ProjectDropdown
              project={project}
              isStaff={isStaff}
              isPm={isPm}
              onDelete={onDelete}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          {isStaff && clientDisplay && (
            <span className="truncate">{clientDisplay}</span>
          )}
          {project.category && (
            <span className="capitalize">{project.category}</span>
          )}
          <span className="text-text-muted ml-auto shrink-0">
            {relativeTime(project.updated_at || project.created_at)}
          </span>
        </div>
      </div>
    );
  }

  // Grid card
  return (
    <div
      data-anim-item
      className="flex flex-col gap-3 p-4 rounded-lg border border-border-default bg-bg-primary hover:border-accent/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary line-clamp-2">
          {project.name}
        </span>
        <ProjectDropdown
          project={project}
          isStaff={isStaff}
          isPm={isPm}
          onDelete={onDelete}
        />
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusToBadgeVariant(project.status)}>
          <span className="capitalize">{project.status}</span>
        </Badge>
        {project.category && (
          <span className="text-xs text-text-muted capitalize">
            {project.category}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 text-xs text-text-secondary">
        {isStaff && clientDisplay && (
          <span className="truncate">{clientDisplay}</span>
        )}
        {isStaff && project.estimation_inr != null && (
          <span className="text-text-muted">
            ₹{Number(project.estimation_inr).toLocaleString("en-IN")}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-default mt-auto">
        {project.deadline ? (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatShortDate(project.deadline)}
          </span>
        ) : (
          <span />
        )}
        <span>{relativeTime(project.updated_at || project.created_at)}</span>
      </div>
    </div>
  );
}
