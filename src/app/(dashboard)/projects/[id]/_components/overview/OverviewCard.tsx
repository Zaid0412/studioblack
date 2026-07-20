import { cn } from "@/lib/utils";

interface OverviewCardProps {
  title?: string;
  /** Right-aligned header slot (e.g. a chart legend hint or a link). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Shared panel for the Overview dashboard — titled card on the secondary bg. */
export function OverviewCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: OverviewCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border-default bg-bg-secondary p-5",
        className
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          )}
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
