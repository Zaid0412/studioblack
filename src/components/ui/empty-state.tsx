import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  /** Contextual Lucide icon displayed inside a rounded container. */
  icon: LucideIcon;
  /** Bold heading text (e.g. "No projects found"). */
  title: string;
  /** Optional muted description shown below the title. */
  description?: string;
  /** Optional call-to-action — renders a link button when `href` is set, or a regular button when `onClick` is set. */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Additional classes applied to the outer wrapper. */
  className?: string;
}

/**
 * Centred placeholder shown when a list, table, or section has no content.
 *
 * Renders an icon, title, optional description, and an optional CTA button
 * that links to a creation page or triggers an action.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const actionButton = action ? (
    action.href ? (
      <Link href={action.href}>
        <Button variant="secondary" size="sm">
          {action.label}
        </Button>
      </Link>
    ) : (
      <Button variant="secondary" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4",
        className
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-bg-elevated mb-4">
        <Icon className="w-6 h-6 text-text-muted" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted text-center max-w-sm">
          {description}
        </p>
      )}
      {actionButton && <div className="mt-4">{actionButton}</div>}
    </div>
  );
}

EmptyState.displayName = "EmptyState";

export { EmptyState };
export type { EmptyStateProps };
