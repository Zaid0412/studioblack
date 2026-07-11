import { SkeletonCard, SkeletonRow } from "@/components/ui/Skeleton";

/** Shared loading skeleton for the role dashboards. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-7 max-w-[1200px]">
      <div className="flex flex-col gap-2">
        <SkeletonCard className="h-10 !p-0 !bg-transparent !rounded-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} columns={3} />
          ))}
        </div>
        <div className="w-full lg:w-80 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
