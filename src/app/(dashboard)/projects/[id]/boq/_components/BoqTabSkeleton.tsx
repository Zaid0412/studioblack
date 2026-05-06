import { Skeleton } from "@/components/ui/Skeleton";
import { GRID_COLS, TABLE_MIN_WIDTH } from "./BoqTable";

/** Loading placeholder that mirrors the real BOQ tab layout. */
export function BoqTabSkeleton() {
  return (
    <div className="px-4 lg:px-10 py-6 flex flex-col gap-5">
      {/* Header row: title + meta vs. risk/action cluster */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2 min-w-0">
          <Skeleton className="h-6 w-64 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="overflow-x-auto">
          <div className={TABLE_MIN_WIDTH}>
            {/* Column header */}
            <div
              className={`grid ${GRID_COLS} gap-2 px-3 py-3 border-b border-border-default`}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-3 rounded" />
              ))}
              <div />
            </div>
            {/* Section header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-bg-elevated border-b border-border-default">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-40 rounded flex-1 max-w-[200px]" />
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            {/* Rows */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`grid ${GRID_COLS} gap-2 px-3 py-3 items-center border-b border-border-default last:border-b-0`}
              >
                <Skeleton className="h-3 w-14 rounded" />
                <Skeleton className="h-4 rounded" />
                <Skeleton className="h-3 w-8 rounded" />
                <Skeleton className="h-4 w-12 rounded ml-auto" />
                <Skeleton className="h-4 w-16 rounded ml-auto" />
                <Skeleton className="h-4 w-20 rounded ml-auto" />
                <Skeleton className="h-4 w-12 rounded ml-auto" />
                <Skeleton className="h-4 w-20 rounded ml-auto" />
                <Skeleton className="h-4 w-16 rounded ml-auto" />
                <Skeleton className="h-4 w-16 rounded ml-auto" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <div />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom totals bar */}
      <div className="flex items-center justify-end gap-6 border-t border-border-default pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 items-end">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
