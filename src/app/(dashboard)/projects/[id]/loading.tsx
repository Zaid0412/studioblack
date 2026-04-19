import { Skeleton, SkeletonRow, SkeletonText } from "@/components/ui/Skeleton";

/** Project detail loading skeleton. */
export default function ProjectDetailLoading() {
  return (
    <div className="p-4 lg:p-10 space-y-6">
      <Skeleton className="h-8 w-64" />
      <SkeletonText lines={2} />
      <div className="rounded-xl border border-border-default bg-bg-elevated">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} columns={4} />
        ))}
      </div>
    </div>
  );
}
