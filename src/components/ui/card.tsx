import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

/**
 * General-purpose content card with optional hover and click behaviour.
 *
 * When `onClick` is provided the card receives `role="button"` and `tabIndex`
 * for keyboard accessibility.
 */
export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-5",
        hover &&
          "cursor-pointer transition-[color,background-color,border-color,transform] hover:border-border-light hover:bg-bg-elevated hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
