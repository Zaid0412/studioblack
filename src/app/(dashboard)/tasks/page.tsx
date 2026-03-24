"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, CheckSquare } from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { authClient } from "@/lib/authClient";
import { tasks as tasksApi, projects as projectsApi } from "@/lib/api";
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
import { TaskRow } from "./_components/TaskRow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgMember {
  userId: string;
  user: { name: string; email: string; image?: string | null };
  role: string;
}

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
  category: "general",
  assignedTo: "",
  dueDate: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Task manager page with smart buckets, filters, and CRUD. */
export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // -- Data state --
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<BucketCounts>({
    all: 0,
    my_tasks: 0,
    created_by_me: 0,
    starred: 0,
    upcoming: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);

  // -- Filter state (from URL) --
  const activeBucket = (searchParams.get("bucket") as Bucket) || "all";
  const searchValue = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const priorityFilter = searchParams.get("priority") || "all";
  const categoryFilter = searchParams.get("category") || "all";
  const projectFilter = searchParams.get("projectId") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

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

  // -- Total task count for pagination --
  const [totalTasks, setTotalTasks] = useState(0);

  // -- Fetch tasks --
  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (activeBucket) params.bucket = activeBucket;
      if (searchValue) params.search = searchValue;
      if (statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (projectFilter !== "all") params.projectId = projectFilter;
      params.page = String(currentPage);
      params.limit = String(PAGE_SIZE);

      const data = await tasksApi.list(params);
      setTasks(data.tasks ?? []);
      setTotalTasks(data.total ?? 0);
      setCounts(
        (data.counts as unknown as BucketCounts) ?? {
          all: 0,
          my_tasks: 0,
          created_by_me: 0,
          starred: 0,
          upcoming: 0,
          completed: 0,
        }
      );
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [
    activeBucket,
    searchValue,
    statusFilter,
    priorityFilter,
    categoryFilter,
    projectFilter,
    currentPage,
  ]);

  // -- Initial load: members, projects, tasks --
  useEffect(() => {
    async function loadSideData() {
      // Org members
      try {
        const { data: org } =
          await authClient.organization.getFullOrganization();
        if (org?.members) {
          setMembers(org.members as unknown as OrgMember[]);
        }
      } catch {
        /* ignore */
      }

      // Projects
      try {
        const data = await projectsApi.list<{ id: string; name: string }>();
        setProjects(
          (Array.isArray(data) ? data : []).map((p) => ({
            id: p.id,
            name: p.name,
          }))
        );
      } catch {
        /* ignore */
      }
    }

    loadSideData();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

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
    fetchTasks,
    setTasks,
    setCounts: setCounts as unknown as React.Dispatch<
      React.SetStateAction<Record<string, number>>
    >,
    defaultForm: EMPTY_FORM,
    onFetchPhases: fetchPhases,
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
        title="Task Manager"
        subtitle="Manage and track tasks across all projects"
        actions={
          <>
            <RefreshButton onRefresh={fetchTasks} />
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              New Task
            </Button>
          </>
        }
      />

      {/* Main layout: sidebar + content */}
      <div className="flex gap-6">
        <TaskBucketSidebar
          activeBucket={activeBucket}
          counts={counts}
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

          {/* Task list table */}
          <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-[600px]">
            {/* Table header */}
            <div className="flex items-center h-11 px-4 bg-[#242424] gap-3">
              <div className="w-3" /> {/* priority dot spacer */}
              <div className="w-6" /> {/* star spacer */}
              <div className="flex-1 text-xs font-bold text-[#666666]">
                Task
              </div>
              <div className="w-[120px] text-xs font-bold text-[#666666]">
                Project
              </div>
              <div className="w-[90px] text-xs font-bold text-[#666666]">
                Category
              </div>
              <div className="w-[80px] text-xs font-bold text-[#666666]">
                Assignee
              </div>
              <div className="w-[90px] text-xs font-bold text-[#666666]">
                Due Date
              </div>
              <div className="w-[100px] text-xs font-bold text-[#666666]">
                Status
              </div>
              <div className="w-8" /> {/* go-to-project spacer */}
              <div className="w-8" />
            </div>

            {/* Table body */}
            <div className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
                </div>
              ) : tasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks found"
                  description="There are no tasks matching your current filters."
                  action={{ label: "Create Task", onClick: openCreate }}
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
                    onGoToProject={(t) =>
                      router.push(
                        `/projects/${t.project_id}?highlightTask=${t.id}`
                      )
                    }
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {!loading && totalTasks > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setParam("page", String(page))}
                showingText={`Showing ${startIdx + 1}–${endIdx} of ${totalTasks} tasks`}
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
            fetchTasks();
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
        onChecklistChange={fetchTasks}
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
