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
import type { TaskListResponse } from "@/lib/api/tasks";
import { useSwrFieldAdapter } from "@/lib/swr";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import type { Task } from "@/types";
import {
  TASK_BUCKETS,
  isApprovalBucket,
  type TaskBucket,
} from "@/lib/validations";
import { pinCommentReviewHref } from "@/lib/pinUtils";
import { TaskDeleteDialog } from "./_components/TaskDeleteDialog";
import {
  TaskBucketSidebar,
  type BucketCounts,
} from "./_components/TaskBucketSidebar";
import { TaskFilterBar } from "./_components/TaskFilterBar";
import { TaskRow } from "./_components/TaskRow";
import { SkeletonRow } from "@/components/ui/Skeleton";

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

  const tasks = data?.tasks ?? [];
  const counts = (data?.counts as unknown as BucketCounts) ?? DEFAULT_COUNTS;
  const totalTasks = data?.total ?? 0;
  const taskRole = data?.role;
  const isRefreshing = isValidating && !isLoading;

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

  // Real tasks open the global side panel (`?task=<id>`); approval-bucket
  // rows (synthesized from pin_comment / comment) deep-link to the source.
  // Synthetic rows with broken refs (e.g. pin_comment without an attachment)
  // get no-op'd — the side-panel branch would push a phantom id and 404.
  const openTask = useCallback(
    (task: Task) => {
      if (task._source && task._source !== "task") {
        if (task._source === "pin_comment") {
          const reviewHref = pinCommentReviewHref(task);
          if (reviewHref) router.push(reviewHref);
          return;
        }
        if (task._source === "comment") {
          if (task.project_id) router.push(`/projects/${task.project_id}`);
          return;
        }
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", task.id);
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
    toggleStar,
    handleDelete,
    openEdit,
  } = useTaskCrud({
    fetchTasks: () => {
      mutate();
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
