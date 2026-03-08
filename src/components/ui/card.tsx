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
        "rounded-xl border border-border-default bg-bg-secondary p-5",
        hover &&
          "cursor-pointer transition-colors hover:border-border-light hover:bg-bg-elevated",
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
