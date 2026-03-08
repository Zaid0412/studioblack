import { cn } from "@/lib/utils";
import type { DesignStatus, ProjectStatus } from "@/types";

type BadgeVariant =
  | "draft"
  | "submitted"
  | "in-review"
  | "approved-arch"
  | "approved-client"
  | "changes-requested"
  | "active"
  | "completed"
  | "archived"
  | "info"
  | "success"
  | "warning"
  | "error";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  draft: "bg-status-draft/20 text-status-draft",
  submitted: "bg-status-submitted/20 text-status-submitted",
  "in-review": "bg-info/20 text-info",
  "approved-arch": "bg-status-approved-arch/20 text-status-approved-arch",
  "approved-client": "bg-status-approved-client/20 text-status-approved-client",
  "changes-requested": "bg-status-changes/20 text-status-changes",
  active: "bg-success/20 text-success",
  completed: "bg-status-approved-arch/20 text-status-approved-arch",
  archived: "bg-status-draft/20 text-status-draft",
  info: "bg-info/20 text-info",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  error: "bg-error/20 text-error",
};

export function Badge({ variant = "draft", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Helper to map status types to badge variants
export function statusToBadgeVariant(
  status: DesignStatus | ProjectStatus
): BadgeVariant {
  return status as BadgeVariant;
}
