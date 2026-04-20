import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";

/** Element categories settings page loading skeleton. */
export default function ElementCategoriesLoading() {
  return (
    <div className="p-4 lg:p-10 space-y-4">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border-default bg-bg-elevated">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}
