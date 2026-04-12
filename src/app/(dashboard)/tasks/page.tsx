"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Plus, CheckSquare } from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { authClient } from "@/lib/authClient";
import { projects as projectsApi } from "@/lib/api";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import type { TaskListResponse } from "@/lib/api/tasks";
import { useSwrFieldAdapter } from "@/lib/swr";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import type { Task, TaskFormData } from "@/types";
import { TaskDetailModal } from "./_components/TaskDetailModal";
import { TaskFormDialog } from "./_components/TaskFormDialog";
import { TaskDeleteDialog } from "./_components/TaskDeleteDialog";
import {
  TaskBucketSidebar,
  type Bucket,
  type BucketCounts,
} from "./_components/TaskBucketSidebar";
import { TaskFilterBar } from "./_components/TaskFilterBar";
import { TaskRow, TaskRowHeader } from "./_components/TaskRow";
import { SkeletonRow } from "@/components/ui/Skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectOption {
  id: string;
  name: string;
}

interface PhaseOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  projectId: "",
  phaseId: "",
  priority: "medium",
  checklistItems: [],
  pendingFiles: [],
  category: "general",
  assignedTo: "",
  dueDate: "",
};

const DEFAULT_COUNTS: BucketCounts = {
  all: 0,
  my_tasks: 0,
  created_by_me: 0,
  starred: 0,
  upcoming: 0,
  completed: 0,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Task manager page with smart buckets, filters, and CRUD. */
export default function TasksPage() {
  const t = useTranslations("tasks");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const { members } = useOrgMembers({ assignableOnly: false });

  // -- Filter state (from URL) --
  const activeBucket = (searchParams.get("bucket") as Bucket) || "all";
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

  // Adapters: translate SWR mutate into setTasks/setCounts for useTaskCrud
  const setTasks = useSwrFieldAdapter<TaskListResponse, Task[]>(
    mutate,
    "tasks"
  );
  const setCounts = useSwrFieldAdapter<
    TaskListResponse,
    Record<string, number>
  >(mutate, "counts");

  // -- Side data --
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);

  // -- Fetch phases for a project --
  const fetchPhases = useCallback(async (projectId: string) => {
    if (!projectId) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const data = await projectsApi.get<{
        phases?: { id: string; name: string }[];
      }>(projectId);
      setPhases(
        (data.phases ?? []).map((p) => ({
          id: p.id,
          name: p.name,
        }))
      );
    } catch {
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  }, []);

  // -- Detail modal --
  const [detailTask, setDetailTask] = useState<Task | null>(null);

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

  // -- Initial load: projects --
  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await projectsApi.list<{ id: string; name: string }>();
        setProjects(
          (Array.isArray(data) ? data : []).map((p) => ({
            id: p.id,
            name: p.name,
          }))
        );
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    }

    loadProjects();
  }, []);

  // -- Task CRUD (dialog, delete, toggle, submit) --
  const {
    dialogOpen,
    setDialogOpen,
    editingTask,
    setEditingTask,
    formData,
    setFormData,
    submitting,
    deleteTarget,
    setDeleteTarget,
    deleting,
    toggleStatus,
    toggleStar,
    handleSubmit,
    handleDelete,
    openEdit,
    openCreate,
  } = useTaskCrud({
    fetchTasks: () => {
      mutate();
    },
    setTasks,
    setCounts,
    defaultForm: EMPTY_FORM,
    onFetchPhases: fetchPhases,
    currentUserId: session?.user?.id,
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
            <Button onClick={openCreate}>
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
            setParam("bucket", bucket === "all" ? "" : bucket)
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
            <TaskRowHeader showGoToProject />

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
                <EmptyState
                  icon={CheckSquare}
                  title={t("noTasksTitle")}
                  description={t("noTasksDescription")}
                  action={{ label: t("createTask"), onClick: openCreate }}
                />
              ) : (
                tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleStar={toggleStar}
                    onToggleStatus={toggleStatus}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    onClick={setDetailTask}
                    onGoToProject={(t) => {
                      if (t.pin_comment_id && t.pin_attachment_id) {
                        router.push(
                          `/projects/${t.project_id}/review/${t.pin_attachment_id}?comments=open&pinId=${t.pin_comment_id}`
                        );
                      } else {
                        router.push(
                          `/projects/${t.project_id}?highlightTask=${t.id}`
                        );
                      }
                    }}
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

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTask(null);
            mutate();
          }
        }}
        onEdit={(task) => {
          setDetailTask(null);
          openEdit(task);
        }}
        onToggleStatus={(task) => {
          toggleStatus(task);
          setDetailTask(null);
        }}
        onToggleStar={(task) => {
          toggleStar(task);
          setDetailTask({ ...task, is_starred: !task.is_starred });
        }}
        onDelete={(task) => {
          setDetailTask(null);
          setDeleteTarget(task);
        }}
        onChecklistChange={() => {
          mutate();
        }}
      />

      {/* Create / Edit Task Dialog */}
      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingTask(null);
            setFormData(EMPTY_FORM);
          }
        }}
        editingTask={editingTask}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onSubmit={handleSubmit}
        projects={projects}
        phases={phases}
        loadingPhases={loadingPhases}
        onProjectChange={fetchPhases}
        members={members.map((m) => ({
          id: m.userId,
          name: m.user.name,
          email: m.user.email,
        }))}
      />

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
