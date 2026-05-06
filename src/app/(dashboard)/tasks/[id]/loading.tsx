import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Loading skeleton for /tasks/[id] — covers the route-transition gap before
 * the page component mounts and its inline `PageSkeleton` takes over.
 */
export default function TaskDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="border-b border-border-default pb-5 mb-5 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
