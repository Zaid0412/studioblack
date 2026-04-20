import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";

/** Element library page loading skeleton — matches sidebar + table layout. */
export default function ElementsLoading() {
  return (
    <div className="p-4 lg:p-10 space-y-6 max-w-[1400px]">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <aside className="lg:w-64 shrink-0 space-y-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </aside>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="rounded-xl border border-border-default bg-bg-elevated">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} columns={6} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
