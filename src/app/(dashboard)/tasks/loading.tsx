import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";

export default function TasksLoading() {
  return (
    <div className="p-4 lg:p-10 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="rounded-xl border border-border-default bg-bg-elevated">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}
