import { cn } from "@/lib/utils";

/** Animated placeholder bar for loading states. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-bg-elevated/60", className)}
      {...props}
    />
  );
}

/** Skeleton matching a stat card layout. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-bg-elevated p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/** Skeleton matching a table row. */
export function SkeletonRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-5 py-3 border-b border-border-default",
        className
      )}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === 0 ? "flex-1" : "w-20")} />
      ))}
    </div>
  );
}

/** Skeleton matching a text paragraph with variable-width lines. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-4/5", "w-3/5", "w-2/3", "w-5/6"];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", widths[i % widths.length])} />
      ))}
    </div>
  );
}
