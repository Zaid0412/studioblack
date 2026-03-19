"use client";

import {
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { avatarColor } from "@/lib/avatarUtils";

// ---------------------------------------------------------------------------
// Types (mirrored from parent)
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  org_id: string;
  project_id: string | null;
  phase_id: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "completed" | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_name: string | null;
  created_by_name: string;
  project_name: string | null;
  phase_name: string | null;
  is_starred: boolean;
}

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onToggleStar?: (task: Task) => void;
  onDelete: (task: Task) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

const STATUS_BADGE_VARIANT: Record<
  string,
  "draft" | "warning" | "success" | "archived"
> = {
  todo: "draft",
  in_progress: "warning",
  completed: "success",
  archived: "archived",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFullDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "completed") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Read-only task detail modal with action buttons. */
export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onEdit,
  onToggleStatus,
  onToggleStar,
  onDelete,
}: TaskDetailModalProps) {
  const router = useRouter();

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
              title={PRIORITY_LABEL[task.priority]}
            />
            <DialogTitle className="text-lg flex-1">{task.title}</DialogTitle>
            {onToggleStar && (
              <button
                onClick={() => onToggleStar(task)}
                className="p-1 rounded transition-colors cursor-pointer"
                title={task.is_starred ? "Unstar" : "Star"}
              >
                <Star
                  className={`w-5 h-5 ${
                    task.is_starred
                      ? "fill-[#F5C518] text-[#F5C518]"
                      : "text-[#666666] hover:text-[#F5C518]"
                  }`}
                />
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Description */}
          {task.description ? (
            <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          ) : (
            <p className="text-sm text-[#666666] italic">No description</p>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {/* Status */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Status
              </span>
              <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}>
                {STATUS_LABEL[task.status] ?? task.status}
              </Badge>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Priority
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                />
                <span className="text-white">
                  {PRIORITY_LABEL[task.priority]}
                </span>
              </div>
            </div>

            {/* Project */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Project
              </span>
              {task.project_name ? (
                <Badge variant="info" className="text-[10px] px-2 py-0.5 w-fit">
                  {task.project_name}
                </Badge>
              ) : (
                <span className="text-[#666666]">&mdash;</span>
              )}
            </div>

            {/* Phase */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Phase
              </span>
              {task.phase_name ? (
                <span className="text-[#A0A0A0]">{task.phase_name}</span>
              ) : (
                <span className="text-[#666666]">&mdash;</span>
              )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Category
              </span>
              <Badge variant="draft" className="text-[10px] px-2 py-0.5 w-fit">
                {capitalize(task.category)}
              </Badge>
            </div>

            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Assignee
              </span>
              {task.assigned_to_name ? (
                <div className="flex items-center gap-2">
                  <Avatar
                    initials={initials(task.assigned_to_name)}
                    size="sm"
                    color={avatarColor(task.assigned_to_name)}
                  />
                  <span className="text-white">{task.assigned_to_name}</span>
                </div>
              ) : (
                <span className="text-[#666666]">Unassigned</span>
              )}
            </div>

            {/* Due Date */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Due Date
              </span>
              {task.due_date ? (
                <span
                  className={`flex items-center gap-1.5 ${
                    isOverdue(task.due_date, task.status)
                      ? "text-red-500"
                      : "text-[#A0A0A0]"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {formatFullDate(task.due_date)}
                </span>
              ) : (
                <span className="text-[#666666]">&mdash;</span>
              )}
            </div>

            {/* Created By */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Created By
              </span>
              <span className="text-[#A0A0A0]">{task.created_by_name}</span>
            </div>

            {/* Created At */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                Created
              </span>
              <span className="text-[#A0A0A0]">
                {formatFullDate(task.created_at)}
              </span>
            </div>

            {/* Completed At */}
            {task.completed_at && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Completed
                </span>
                <span className="text-green-400">
                  {formatFullDate(task.completed_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div className="flex gap-2">
            {task.project_id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  router.push(
                    `/projects/${task.project_id}?highlightTask=${task.id}`
                  );
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Go to Project
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(task);
              }}
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggleStatus(task)}
            >
              {task.status === "completed" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5" />
                  Reopen
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete
                </>
              )}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onDelete(task);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
