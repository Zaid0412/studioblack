"use client";

import {
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Star,
  ExternalLink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { avatarColor } from "@/lib/avatarUtils";
import {
  PRIORITY_DOT,
  STATUS_BADGE_VARIANT,
  initials,
  isOverdue,
  formatDate,
  capitalize,
} from "@/lib/taskUtils";
import { MentionRenderer } from "@/components/ui/MentionRenderer";
import type { Task } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task;
  onToggleStar: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** When undefined, the row is not clickable. */
  onClick?: (task: Task) => void;
  /** When undefined, the go-to-project button is hidden. */
  onGoToProject?: (task: Task) => void;
  /** Show the project badge column. Default `true`. */
  showProject?: boolean;
}

// ---------------------------------------------------------------------------
// Table Header
// ---------------------------------------------------------------------------

interface TaskRowHeaderProps {
  /** Show the project column header. Default `true`. */
  showProject?: boolean;
  /** Show the go-to-project spacer column. Default `false`. */
  showGoToProject?: boolean;
}

/** Desktop table header that matches TaskRow column widths. */
export function TaskRowHeader({
  showProject = true,
  showGoToProject = false,
}: TaskRowHeaderProps) {
  const t = useTranslations("tasks");
  return (
    <div className="hidden lg:flex items-center h-11 px-4 bg-bg-elevated gap-3">
      <div className="w-3" /> {/* priority dot spacer */}
      <div className="w-6" /> {/* star spacer */}
      <div className="flex-1 text-xs font-bold text-text-muted">
        {t("task")}
      </div>
      {showProject && (
        <div className="w-[120px] text-xs font-bold text-text-muted">
          {t("project")}
        </div>
      )}
      <div className="w-[90px] text-xs font-bold text-text-muted">
        {t("category")}
      </div>
      <div className="w-[80px] text-xs font-bold text-text-muted">
        {t("assignee")}
      </div>
      <div className="w-[90px] text-xs font-bold text-text-muted">
        {t("dueDate")}
      </div>
      <div className="w-[100px] text-xs font-bold text-text-muted">
        {t("status")}
      </div>
      {showGoToProject && <div className="w-8" />}
      <div className="w-8" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// i18n key maps
// ---------------------------------------------------------------------------

const STATUS_TKEY: Record<string, string> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  archived: "statusArchived",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Single task row with status, priority, assignee, and action menu. */
export function TaskRow({
  task,
  onToggleStar,
  onToggleStatus,
  onEdit,
  onDelete,
  onClick,
  onGoToProject,
  showProject = true,
}: TaskRowProps) {
  const t = useTranslations("tasks");
  const isClickable = !!onClick;
  // Shared action menu used in both layouts
  const actionMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors cursor-pointer"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onToggleStar(task)}>
          <Star
            className={`w-4 h-4 ${task.is_starred ? "fill-accent text-accent" : ""}`}
          />
          {task.is_starred ? t("unstar") : t("star")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(task)}>
          <Edit className="w-4 h-4" />
          {t("editTask")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleStatus(task)}>
          <CheckCircle2 className="w-4 h-4" />
          {task.status === "completed" ? t("reopen") : t("complete")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={() => onDelete(task)}>
          <Trash2 className="w-4 h-4" />
          {t("deleteTask")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div data-task-id={task.id}>
      {/* ── Desktop row ── */}
      <div
        onClick={isClickable ? () => onClick(task) : undefined}
        className={`hidden lg:flex items-center min-h-[56px] px-4 py-2 border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors gap-3${isClickable ? " cursor-pointer" : ""}`}
      >
        {/* Priority dot */}
        <div className="w-3 flex justify-center shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
              />
            </TooltipTrigger>
            <TooltipContent>{capitalize(task.priority)}</TooltipContent>
          </Tooltip>
        </div>

        {/* Star toggle */}
        <div className="w-6 flex justify-center shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(task);
                }}
                className="p-0.5 rounded transition-colors cursor-pointer"
              >
                <Star
                  className={`w-4 h-4 ${
                    task.is_starred
                      ? "fill-accent text-accent"
                      : "text-text-muted hover:text-accent"
                  }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {task.is_starred ? t("unstar") : t("star")}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-text-primary truncate">
              {task.title}
            </span>
            {task.checklist_total > 0 && (
              <span className="text-[10px] text-text-muted shrink-0">
                [{task.checklist_done}/{task.checklist_total}]
              </span>
            )}
          </div>
          {task.description && (
            <span className="text-xs text-text-muted block truncate">
              <MentionRenderer content={task.description.split("\n")[0]} />
            </span>
          )}
        </div>

        {/* Project + phase badge */}
        {showProject && (
          <div className="w-[120px] shrink-0">
            {task.project_name ? (
              <div className="flex flex-col gap-0.5">
                <Badge
                  variant="info"
                  className="text-[10px] px-2 py-0.5 truncate max-w-full"
                >
                  {task.project_name}
                </Badge>
                {task.phase_name && (
                  <span className="text-[10px] text-text-muted truncate">
                    {task.phase_name}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[13px] text-text-muted">&mdash;</span>
            )}
          </div>
        )}

        {/* Category badge */}
        <div className="w-[90px] shrink-0">
          <Badge variant="draft" className="text-[10px] px-2 py-0.5">
            {capitalize(task.category)}
          </Badge>
        </div>

        {/* Assignee */}
        <div className="w-[80px] shrink-0 flex items-center">
          {task.assigned_to_name ? (
            <Avatar
              initials={initials(task.assigned_to_name)}
              size="sm"
              color={avatarColor(task.assigned_to || "")}
            />
          ) : (
            <span className="text-[13px] text-text-muted">&mdash;</span>
          )}
        </div>

        {/* Due date */}
        <div className="w-[90px] shrink-0">
          {task.due_date ? (
            <span
              className={`flex items-center gap-1 text-xs ${
                isOverdue(task.due_date, task.status)
                  ? "text-red-500"
                  : "text-text-secondary"
              }`}
            >
              <Calendar className="w-3 h-3" />
              {formatDate(task.due_date)}
            </span>
          ) : (
            <span className="text-[13px] text-text-muted">&mdash;</span>
          )}
        </div>

        {/* Status badge (clickable) */}
        <div className="w-[100px] shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(task);
                }}
                className="cursor-pointer"
              >
                <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}>
                  {t(STATUS_TKEY[task.status] ?? task.status)}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("clickToChangeStatus")}</TooltipContent>
          </Tooltip>
        </div>

        {/* Go to project */}
        {onGoToProject && (
          <div className="w-8 flex justify-center shrink-0">
            {task.project_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoToProject(task);
                    }}
                    className="p-1 rounded-md text-text-muted hover:text-accent hover:bg-bg-input transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("goToProject")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="w-8 flex justify-end shrink-0">{actionMenu}</div>
      </div>

      {/* ── Mobile card ── */}
      <div
        onClick={isClickable ? () => onClick(task) : undefined}
        className={`flex flex-col gap-2 p-4 border-b border-border-default last:border-b-0 transition-colors lg:hidden${isClickable ? " active:bg-bg-elevated/50 cursor-pointer" : ""}`}
      >
        {/* Row 1: priority dot + title + star + menu */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
          />
          <span className="text-sm font-semibold text-text-primary truncate flex-1">
            {task.title}
          </span>
          {task.checklist_total > 0 && (
            <span className="text-[10px] text-text-muted shrink-0">
              [{task.checklist_done}/{task.checklist_total}]
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(task);
            }}
            className="p-0.5 shrink-0 cursor-pointer"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                task.is_starred ? "fill-accent text-accent" : "text-text-muted"
              }`}
            />
          </button>
          <div className="shrink-0">{actionMenu}</div>
        </div>

        {/* Row 2: status + category + project badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(task);
            }}
            className="cursor-pointer"
          >
            <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}>
              {t(STATUS_TKEY[task.status] ?? task.status)}
            </Badge>
          </button>
          <Badge variant="draft" className="text-[10px] px-2 py-0.5">
            {capitalize(task.category)}
          </Badge>
          {showProject && task.project_name && (
            <Badge
              variant="info"
              className="text-[10px] px-2 py-0.5 truncate max-w-[140px]"
            >
              {task.project_name}
            </Badge>
          )}
        </div>

        {/* Row 3: assignee + due date */}
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          {task.assigned_to_name && (
            <div className="flex items-center gap-1.5">
              <Avatar
                initials={initials(task.assigned_to_name)}
                size="xs"
                color={avatarColor(task.assigned_to || "")}
              />
              <span className="truncate">{task.assigned_to_name}</span>
            </div>
          )}
          {task.due_date && (
            <span
              className={`flex items-center gap-1 ml-auto ${
                isOverdue(task.due_date, task.status)
                  ? "text-red-500"
                  : "text-text-secondary"
              }`}
            >
              <Calendar className="w-3 h-3" />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
