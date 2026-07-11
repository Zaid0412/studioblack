"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Plus, CheckSquare } from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import type { TaskListResponse, TaskCountsResponse } from "@/lib/api/tasks";
import { API } from "@/lib/api/routes";
import { useSwrFieldAdapter } from "@/lib/swr";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import type { Task } from "@/types";
import {
  TASK_BUCKETS,
  isApprovalBucket,
  type TaskBucket,
} from "@/lib/validations";
import { getTaskOpenTarget } from "@/lib/taskUtils";
import { TaskDeleteDialog } from "./_components/TaskDeleteDialog";
import {
  TaskBucketSidebar,
  type BucketCounts,
} from "./_components/TaskBucketSidebar";
import { TaskFilterBar } from "./_components/TaskFilterBar";
import { TaskRow } from "./_components/TaskRow";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

const DEFAULT_COUNTS: BucketCounts = TASK_BUCKETS.reduce(
  (acc, key) => ({ ...acc, [key]: 0 }),
  {} as BucketCounts
);

const VALID_BUCKETS_SET = new Set<string>(TASK_BUCKETS);
function asBucket(value: string | null): TaskBucket {
  return value && VALID_BUCKETS_SET.has(value)
    ? (value as TaskBucket)
    : "all_tasks";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Task manager page with smart buckets, filters, and CRUD. */
export default function TasksPage() {
  const t = useTranslations("tasks");
  const router = useRouter();
  const searchParams = useSearchParams();

  // -- Filter state (from URL) --
  const activeBucket = asBucket(searchParams.get("bucket"));
  const searchValue = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const priorityFilter = searchParams.get("priority") || "all";
  const categoryFilter = searchParams.get("category") || "all";
  const projectFilter = searchParams.get("projectId") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  // -- Task data (SWR) --
  const swrKey = useMemo(() => {
    const params = new URLSearchParams();
    if (activeBucket) params.set("bucket", activeBucket);
    if (searchValue) params.set("search", searchValue);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (projectFilter !== "all") params.set("projectId", projectFilter);
    params.set("page", String(currentPage));
    params.set("limit", String(PAGE_SIZE));
    return `/api/tasks?${params.toString()}`;
  }, [
    activeBucket,
    searchValue,
    statusFilter,
    priorityFilter,
    categoryFilter,
    projectFilter,
    currentPage,
  ]);

  const { data, isLoading, isValidating, mutate } = useSWR<TaskListResponse>(
    swrKey,
    { keepPreviousData: true }
  );

  // Counts run on a separate cache key so paginated list requests don't
  // refire the 3-query count bundle. 60s dedupe is safe because counts
  // change only on writes (create/delete/star/status), all of which call
  // `mutateCounts()` explicitly below via `useTaskCrud`.
  const { data: countsData, mutate: mutateCounts } = useSWR<TaskCountsResponse>(
    API.taskCounts(),
    { dedupingInterval: 60_000 }
  );

  const tasks = data?.tasks ?? [];
  const counts =
    (countsData?.counts as unknown as BucketCounts) ?? DEFAULT_COUNTS;
  const totalTasks = data?.total ?? 0;
  const taskRole = data?.role ?? countsData?.role;
  const isRefreshing = isValidating && !isLoading;

  // Cascade the rows in whenever the visible set changes (filter/sort/page) —
  // keyed on the id set so a background revalidation with the same rows doesn't
  // re-stagger.
  const listRef = useStaggerReveal<HTMLDivElement>(
    tasks.map((task) => task.id).join(",")
  );

  // Adapter: translate SWR mutate into setTasks for useTaskCrud
  const setTasks = useSwrFieldAdapter<TaskListResponse, Task[]>(
    mutate,
    "tasks"
  );

  // -- URL helpers --
  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset page when filters change
      if (key !== "page") params.delete("page");
      router.replace(`/tasks?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Routing decision lives in `getTaskOpenTarget` (taskUtils) so the row
  // click here, the OpenLink anchor in TaskRow, and any future surface
  // stay in lockstep.
  const openTask = useCallback(
    (task: Task) => {
      const target = getTaskOpenTarget(task);
      if (target.kind === "none") return;
      if (target.kind === "link") {
        router.push(target.href);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", target.taskId);
      router.replace(`/tasks?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // -- Task CRUD (delete, toggle, edit-routes-to-page) --
  const {
    deleteTarget,
    setDeleteTarget,
    deleting,
    toggleStatus,
    setStatus,
    toggleStar,
    handleDelete,
    openEdit,
  } = useTaskCrud({
    fetchTasks: () => {
      mutate();
      mutateCounts();
    },
    setTasks,
  });

  // -- Pagination (server-side) --
  const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalTasks);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <PageHeader
        title={t("pageTitle")}
        subtitle={t("pageSubtitle")}
        actions={
          <>
            <RefreshButton
              onRefresh={() => {
                mutate();
                mutateCounts();
              }}
            />
            <Button onClick={() => router.push("/tasks/new")}>
              <Plus className="w-4 h-4" />
              {t("newTask")}
            </Button>
          </>
        }
      />

      {/* Main layout: sidebar + content */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <TaskBucketSidebar
          activeBucket={activeBucket}
          counts={counts}
          role={taskRole}
          onSelect={(bucket) =>
            setParam("bucket", bucket === "all_tasks" ? "" : bucket)
          }
        />

        {/* ---- Main Content ---- */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <TaskFilterBar
            searchValue={searchValue}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            categoryFilter={categoryFilter}
            onFilterChange={setParam}
          />

          {/* Task list */}
          <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden flex flex-col min-h-0 lg:min-h-[600px]">
            {/* Table body */}
            <div
              ref={listRef}
              className={`flex-1 transition-opacity ${isRefreshing ? "opacity-60 pointer-events-none" : ""}`}
            >
              {isLoading ? (
                <div className="flex flex-col">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} columns={5} />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                isApprovalBucket(activeBucket) ? (
                  <EmptyState
                    icon={CheckSquare}
                    title={t("noTasksTitle")}
                    description={t("noTasksDescription")}
                  />
                ) : (
                  <EmptyState
                    icon={CheckSquare}
                    title={t("noTasksTitle")}
                    description={t("noTasksDescription")}
                    action={{
                      label: t("createTask"),
                      onClick: () => router.push("/tasks/new"),
                    }}
                  />
                )
              ) : (
                tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleStar={toggleStar}
                    onToggleStatus={toggleStatus}
                    onSetStatus={setStatus}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    onClick={openTask}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {!isLoading && totalTasks > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setParam("page", String(page))}
                showingText={t("showingTasks", {
                  start: startIdx + 1,
                  end: endIdx,
                  total: totalTasks,
                })}
              />
            )}
          </div>
        </div>
      </div>

      {/* Detail view is the global TaskSidePanelHost mounted in the dashboard
       * layout — it opens whenever ?task=<id> is in the URL, so a row click
       * just calls openTask above. Create + edit live at /tasks/new and
       * /tasks/[id] respectively. */}

      {/* Delete Confirmation Dialog */}
      <TaskDeleteDialog
        task={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        deleting={deleting}
        onDelete={handleDelete}
      />
    </div>
  );
}
