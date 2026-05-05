"use client";

import {
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Star,
  ListTodo,
  Compass,
  FileCheck,
  RefreshCw,
  Hammer,
  Send,
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
import { avatarColor } from "@/lib/avatarUtils";
import {
  STATUS_BADGE_VARIANT,
  initials,
  isOverdue,
  formatDate,
} from "@/lib/taskUtils";
import type { Task, TaskCategory } from "@/types";

// ---------------------------------------------------------------------------
// Category icon + color encoding (per the redesign rule: type-icon = category)
// ---------------------------------------------------------------------------

interface CategoryStyle {
  icon: React.ElementType;
  /** Tailwind classes for the 32x32 leading icon square. */
  classes: string;
}

const CATEGORY_STYLES: Record<TaskCategory, CategoryStyle> = {
  general: { icon: ListTodo, classes: "bg-text-muted/15 text-text-muted" },
  design: { icon: Compass, classes: "bg-blue-500/15 text-blue-500" },
  review: { icon: FileCheck, classes: "bg-orange-500/15 text-orange-500" },
  revision: { icon: RefreshCw, classes: "bg-purple-500/15 text-purple-500" },
  production: { icon: Hammer, classes: "bg-green-500/15 text-green-500" },
  handover: { icon: Send, classes: "bg-teal-500/15 text-teal-500" },
};

function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category as TaskCategory] ?? CATEGORY_STYLES.general;
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

interface TaskRowProps {
  task: Task;
  onToggleStar: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** When undefined, the row is not clickable. */
  onClick?: (task: Task) => void;
  /**
   * Reserved — the new design opens the side panel on click; deep-link to
   * the project page lives in the action menu. Prop kept for back-compat.
   */
  onGoToProject?: (task: Task) => void;
  /**
   * Reserved — kept so existing callers don't break. The new layout doesn't
   * use a project column; project is shown in the row meta line.
   */
  showProject?: boolean;
}

/**
 * Redesigned task row matching the pencil mockup.
 *
 * Layout: leading 32x32 category-tinted icon square, then a stacked
 * title + meta line (`project · phase · opened by …`), then a status pill,
 * assignee avatar, due date, and a `…` action menu. Click the row body to
 * open the global task side panel; click status to toggle.
 */
export function TaskRow({
  task,
  onToggleStar,
  onToggleStatus,
  onEdit,
  onDelete,
  onClick,
}: TaskRowProps) {
  const t = useTranslations("tasks");
  const isClickable = !!onClick;
  const { icon: CategoryIcon, classes: categoryClasses } = getCategoryStyle(
    task.category
  );

  const metaParts: string[] = [];
  if (task.project_name) metaParts.push(task.project_name);
  if (task.phase_name) metaParts.push(task.phase_name);
  if (task.created_by_name) metaParts.push(`opened by ${task.created_by_name}`);

  return (
    <div
      data-task-id={task.id}
      onClick={isClickable ? () => onClick(task) : undefined}
      className={`flex items-center gap-3 px-4 py-3 border-b border-border-default last:border-b-0 transition-colors hover:bg-bg-elevated/40${
        isClickable ? " cursor-pointer" : ""
      }`}
    >
      {/* Category icon square — encodes the task category. */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${categoryClasses}`}
        aria-hidden="true"
      >
        <CategoryIcon className="w-4 h-4" />
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
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
        {metaParts.length > 0 && (
          <span className="text-xs text-text-muted truncate">
            {metaParts.join(" · ")}
          </span>
        )}
      </div>

      {/* Status pill — clickable to toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus(task);
        }}
        className="cursor-pointer shrink-0"
        aria-label={t("clickToChangeStatus")}
      >
        <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}>
          {t(STATUS_TKEY[task.status] ?? task.status)}
        </Badge>
      </button>

      {/* Assignee */}
      <div className="shrink-0 hidden sm:block">
        {task.assigned_to_name ? (
          <Avatar
            initials={initials(task.assigned_to_name)}
            size="sm"
            color={avatarColor(task.assigned_to || "")}
          />
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </div>

      {/* Due date */}
      <div className="w-[90px] shrink-0 hidden md:block">
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
          <span className="text-xs text-text-muted">—</span>
        )}
      </div>

      {/* Actions — kept on the row until edit/delete land in the side panel. */}
      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors cursor-pointer"
              aria-label="Task actions"
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
      </div>
    </div>
  );
}
