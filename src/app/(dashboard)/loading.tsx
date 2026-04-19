import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/** Dashboard loading skeleton. */
export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-10 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
