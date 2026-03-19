import type { TaskPriority, TaskStatus, TaskCategory } from "@/types";

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

export const STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "completed",
];

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

export const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

export const STATUS_DOT: Record<string, string> = {
  todo: "bg-blue-500",
  in_progress: "bg-yellow-500",
  completed: "bg-green-500",
  archived: "bg-gray-500",
};

export const STATUS_BADGE_VARIANT: Record<
  string,
  "draft" | "warning" | "success" | "archived"
> = {
  todo: "draft",
  in_progress: "warning",
  completed: "success",
  archived: "archived",
};

export const NEXT_STATUS: Record<string, "todo" | "in_progress" | "completed"> =
  {
    todo: "in_progress",
    in_progress: "completed",
    completed: "todo",
  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 *
 */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 *
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 *
 */
export function isOverdue(dueDate: string | null, status?: string): boolean {
  if (!dueDate) return false;
  if (status === "completed") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

/**
 *
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 *
 */
export function formatFullDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
