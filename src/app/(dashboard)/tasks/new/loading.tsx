import { Skeleton } from "@/components/ui/Skeleton";

/** Loading skeleton for /tasks/new — mirrors the form + sidebar layout. */
export default function NewTaskLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb + heading */}
      <header className="border-b border-border-default pb-5 mb-6">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-48" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Main column — title + description + submit */}
        <div className="space-y-4 min-w-0">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Sidebar — 6 picker rows */}
        <aside style={{ marginTop: 12 }}>
          <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < 5 ? "border-b border-border-default" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Skeleton className="w-4 h-4 rounded shrink-0" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
