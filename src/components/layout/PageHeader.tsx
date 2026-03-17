import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header with a title, optional subtitle, and action buttons.
 *
 * Used at the top of every main content page to provide consistent heading
 * layout and a slot for primary actions (e.g. "New Project" button).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 pb-6", className)}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">{actions}</div>
      )}
    </div>
  );
}
