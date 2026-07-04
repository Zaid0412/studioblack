import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Circle,
  CircleCheck,
  CircleDashed,
  Eye,
  Factory,
  PackageCheck,
  PenTool,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus, TaskCategory } from "@/types";
import { deriveInitials } from "@/lib/utils";
import { pinCommentReviewHref } from "./pinUtils";

// ---------------------------------------------------------------------------
// Option arrays (for dropdowns / selects)
// ---------------------------------------------------------------------------

export const PRIORITIES: readonly TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const CATEGORIES: readonly TaskCategory[] = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
];

// "archived" is intentionally excluded — users cannot set a task to archived
// via the status dropdown; archiving is handled by a separate action.
export const STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "completed",
];

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

/** Tailwind classes for a priority pill — used in the task sidebar pickers. */
export const PRIORITY_PILL: Record<TaskPriority, string> = {
  urgent: "bg-red-500/10 text-red-500",
  high: "bg-warning/10 text-warning",
  medium: "bg-info/10 text-info",
  low: "bg-text-muted/15 text-text-muted",
};

/** Same lookup as `PRIORITY_PILL` but tolerates an unknown string. */
export function priorityClass(priority: string): string {
  return PRIORITY_PILL[priority as TaskPriority] ?? "bg-info/10 text-info";
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-blue-500",
  in_progress: "bg-yellow-500",
  completed: "bg-green-500",
  archived: "bg-gray-500",
};

/** Icons for task select/picker options (labels come from the maps above). */
export const PRIORITY_ICON: Record<TaskPriority, LucideIcon> = {
  low: ArrowDown,
  medium: ArrowRight,
  high: ArrowUp,
  urgent: AlertTriangle,
};

export const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  general: Circle,
  design: PenTool,
  review: Eye,
  revision: RefreshCw,
  production: Factory,
  handover: PackageCheck,
};

export const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  todo: Circle,
  in_progress: CircleDashed,
  completed: CircleCheck,
  archived: Archive,
};

export const STATUS_BADGE_VARIANT: Record<
  TaskStatus,
  "draft" | "warning" | "success" | "archived"
> = {
  todo: "draft",
  in_progress: "warning",
  completed: "success",
  archived: "archived",
};

export const NEXT_STATUS: Record<
  TaskStatus,
  "todo" | "in_progress" | "completed"
> = {
  todo: "in_progress",
  in_progress: "completed",
  completed: "todo",
  archived: "todo",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `deriveInitials` from `@/lib/utils` directly.
 * Re-exported here for backward compatibility.
 */
export const initials = deriveInitials;

/** Capitalize the first character of a string. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Return true if the due date is in the past and the task is not completed. */
export function isOverdue(dueDate: string | null, status?: string): boolean {
  if (!dueDate) return false;
  if (status === "completed") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

/**
 * Where a task row should open when clicked.
 *
 * Real tasks open the global side panel (the caller pushes `?task=<id>`
 * onto the URL — `kind === "panel"`). Approval-bucket rows are
 * synthesized from `pin_comment` / `comment` and deep-link to the
 * underlying record (`kind === "link"` with an `href`). Synthetic rows
 * with broken refs (e.g. a pin_comment without an attachment, or a
 * comment without a project) get `kind === "none"` — the row is shown
 * but not clickable, instead of falling through to a phantom task id.
 *
 * Centralized so `openTask` (tasks/page.tsx), `OpenLink` (TaskRow), and
 * any future surface stay in lockstep on the routing decision.
 */
export type TaskOpenTarget =
  | { kind: "panel"; taskId: string; label: string }
  | { kind: "link"; href: string; label: string }
  | { kind: "none" };

/** Resolve a task row to its click destination — see `TaskOpenTarget` above. */
export function getTaskOpenTarget(task: Task): TaskOpenTarget {
  if (task._source === "pin_comment") {
    const reviewHref = pinCommentReviewHref(task);
    if (!reviewHref) return { kind: "none" };
    return {
      kind: "link",
      href: reviewHref,
      label: "Open review comment",
    };
  }
  if (task._source === "comment") {
    if (!task.project_id) return { kind: "none" };
    return {
      kind: "link",
      href: `/projects/${task.project_id}`,
      label: "Open project",
    };
  }
  return { kind: "panel", taskId: task.id, label: "Open task page" };
}

export {
  formatShortDate as formatDate,
  formatDate as formatFullDate,
} from "./formatDate";
