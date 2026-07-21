"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, CheckSquare, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import type { Task } from "@/types";
import type { TaskListResponse } from "@/lib/api/tasks";
import { useSwrFieldAdapter } from "@/lib/swr";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import { TaskRow } from "@/app/(dashboard)/tasks/_components/TaskRow";
import { TaskDeleteDialog } from "@/app/(dashboard)/tasks/_components/TaskDeleteDialog";

interface TaskSectionProps {
  projectId: string;
  activePhaseId: string;
  highlightTaskId?: string | null;
}

/** Task list section for a project detail page. */
export function TaskSection({
  projectId,
  activePhaseId,
  highlightTaskId,
}: TaskSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Open the global task side panel for a task — same overlay as `/tasks`.
   * The host listens for `?task=<id>` and renders on top of this page.
   */
  const openTask = useCallback(
    (task: Task) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", task.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // -- Task data (SWR, filtered by phase on the server) --
  const {
    data: taskData,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<TaskListResponse>(
    `/api/tasks?projectId=${projectId}&phaseId=${activePhaseId}&limit=100`,
    { keepPreviousData: true }
  );

  const allTasks = taskData?.tasks ?? [];
  const isRefreshing = isValidating && !isLoading;

  // Adapter: translate SWR mutate into setTasks for useTaskCrud
  const setAllTasks = useSwrFieldAdapter<TaskListResponse, Task[]>(
    mutate,
    "tasks"
  );

  // -- Row CRUD (delete, toggle, edit-routes-to-page) --
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
    },
    setTasks: setAllTasks,
  });

  // -- Highlight task from URL --
  useEffect(() => {
    if (!highlightTaskId || isLoading) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${highlightTaskId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("task-highlight-glow");
        setTimeout(() => el.classList.remove("task-highlight-glow"), 2500);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightTaskId, isLoading]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-text-secondary" />
          <h2 className="text-base font-semibold text-text-primary">Tasks</h2>
          <Badge variant="draft" className="text-[10px] px-2 py-0.5">
            {allTasks.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/tasks/new?projectId=${projectId}`)}
        >
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Task list */}
      <div
        className={`rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden transition-opacity ${isRefreshing ? "opacity-60 pointer-events-none" : ""}`}
      >
        {isLoading ? (
          <div className="flex flex-col">
            {/* Header row skeleton */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-border-default">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            {/* Task row skeletons */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3 border-b border-border-default last:border-b-0"
              >
                <Skeleton className="w-4 h-4 rounded shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : allTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Create a task to get started."
            action={{
              label: "Create Task",
              onClick: () => router.push(`/tasks/new?projectId=${projectId}`),
            }}
          />
        ) : (
          <>
            {/* Table body */}
            {allTasks.map((task) => (
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
            ))}
          </>
        )}
      </div>

      {/* View all link */}
      <div className="flex justify-center">
        <Link
          href={`/tasks?projectId=${projectId}`}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-strong transition-colors"
        >
          View all tasks in Task Manager
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

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
