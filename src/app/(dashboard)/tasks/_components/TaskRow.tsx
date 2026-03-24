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
  PRIORITY_DOT,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  initials,
  isOverdue,
  formatDate,
  capitalize,
} from "@/lib/taskUtils";
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
  onClick: (task: Task) => void;
  onGoToProject: (task: Task) => void;
}

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
}: TaskRowProps) {
  return (
    <div
      onClick={() => onClick(task)}
      className="flex items-center min-h-[56px] px-4 py-2 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors gap-3 cursor-pointer"
    >
      {/* Priority dot */}
      <div className="w-3 flex justify-center shrink-0">
        <span
          className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
          title={capitalize(task.priority)}
        />
      </div>

      {/* Star toggle */}
      <div className="w-6 flex justify-center shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(task);
          }}
          className="p-0.5 rounded transition-colors cursor-pointer"
          title={task.is_starred ? "Unstar" : "Star"}
        >
          <Star
            className={`w-4 h-4 ${
              task.is_starred
                ? "fill-[#F5C518] text-[#F5C518]"
                : "text-[#666666] hover:text-[#F5C518]"
            }`}
          />
        </button>
      </div>

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">
            {task.title}
          </span>
          {task.checklist_total > 0 && (
            <span className="text-[10px] text-[#666666] shrink-0">
              [{task.checklist_done}/{task.checklist_total}]
            </span>
          )}
        </div>
        {task.description && (
          <span className="text-xs text-[#666666] block truncate">
            {task.description.split("\n")[0]}
          </span>
        )}
      </div>

      {/* Project + phase badge */}
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
              <span className="text-[10px] text-[#666666] truncate">
                {task.phase_name}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-[#666666]">&mdash;</span>
        )}
      </div>

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
            color={avatarColor(task.assigned_to_name)}
          />
        ) : (
          <span className="text-[13px] text-[#666666]">&mdash;</span>
        )}
      </div>

      {/* Due date */}
      <div className="w-[90px] shrink-0">
        {task.due_date ? (
          <span
            className={`flex items-center gap-1 text-xs ${
              isOverdue(task.due_date, task.status)
                ? "text-red-500"
                : "text-[#A0A0A0]"
            }`}
          >
            <Calendar className="w-3 h-3" />
            {formatDate(task.due_date)}
          </span>
        ) : (
          <span className="text-[13px] text-[#666666]">&mdash;</span>
        )}
      </div>

      {/* Status badge (clickable) */}
      <div className="w-[100px] shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task);
          }}
          className="cursor-pointer"
          title="Click to change status"
        >
          <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}>
            {STATUS_LABEL[task.status] ?? task.status}
          </Badge>
        </button>
      </div>

      {/* Go to project */}
      <div className="w-8 flex justify-center shrink-0">
        {task.project_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGoToProject(task);
            }}
            className="p-1 rounded-md text-[#666666] hover:text-[#F5C518] hover:bg-[#2A2A2A] transition-colors cursor-pointer"
            title="Go to project"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="w-8 flex justify-end shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md text-[#666666] hover:text-white hover:bg-[#2A2A2A] transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggleStar(task)}>
              <Star
                className={`w-4 h-4 ${task.is_starred ? "fill-[#F5C518] text-[#F5C518]" : ""}`}
              />
              {task.is_starred ? "Unstar" : "Star"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Edit className="w-4 h-4" />
              Edit Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleStatus(task)}>
              <CheckCircle2 className="w-4 h-4" />
              {task.status === "completed" ? "Reopen" : "Complete"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => onDelete(task)}>
              <Trash2 className="w-4 h-4" />
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
