import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";

/** Vendors page loading skeleton — header + filter row + table. */
export default function VendorsLoading() {
  return (
    <div className="p-4 lg:p-10 space-y-6 max-w-[1400px]">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col lg:flex-row gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-64 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border-default bg-bg-elevated">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} columns={7} />
        ))}
      </div>
    </div>
  );
}
