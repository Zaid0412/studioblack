"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  Calendar,
  CheckSquare,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  ListTodo,
  User,
  PenLine,
  Star,
  Clock,
  ExternalLink,
} from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { avatarColor } from "@/lib/avatarUtils";
import { authClient } from "@/lib/authClient";
import { tasks as tasksApi, projects as projectsApi } from "@/lib/api";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import {
  STATUSES,
  PRIORITIES,
  CATEGORIES,
  PRIORITY_DOT,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  initials,
  isOverdue,
  formatDate,
  capitalize,
} from "@/lib/taskUtils";
import type { Task, TaskFormData } from "@/types";
import { TaskDetailModal } from "./_components/TaskDetailModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCounts {
  all: number;
  my_tasks: number;
  created_by_me: number;
  starred: number;
  upcoming: number;
  completed: number;
}

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

type Bucket =
  | "all"
  | "my_tasks"
  | "created_by_me"
  | "starred"
  | "upcoming"
  | "completed";

const BUCKETS: { key: Bucket; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All", icon: ListTodo },
  { key: "my_tasks", label: "My Tasks", icon: User },
  { key: "created_by_me", label: "Created by Me", icon: PenLine },
  { key: "starred", label: "Starred", icon: Star },
  { key: "upcoming", label: "Upcoming", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

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
  const [counts, setCounts] = useState<TaskCounts>({
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

      const data = await tasksApi.list<{ tasks: Task[]; counts: TaskCounts }>(
        params
      );
      setTasks(data.tasks ?? []);
      setCounts(
        data.counts ?? {
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

  // -- Pagination --
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, tasks.length);
  const paginatedTasks = tasks.slice(startIdx, endIdx);

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
        {/* ---- Bucket Sidebar ---- */}
        <aside className="w-56 shrink-0 rounded-xl bg-[#1A1A1A] border border-[#333333] overflow-hidden self-start">
          <div className="flex flex-col py-2">
            {BUCKETS.map((bucket) => {
              const isActive = activeBucket === bucket.key;
              const count = counts[bucket.key] ?? 0;
              const Icon = bucket.icon;
              return (
                <button
                  key={bucket.key}
                  onClick={() =>
                    setParam("bucket", bucket.key === "all" ? "" : bucket.key)
                  }
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#F5C518]/10 text-[#F5C518] border-l-2 border-[#F5C518] font-semibold"
                      : "text-[#A0A0A0] hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{bucket.label}</span>
                  <span
                    className={`text-xs tabular-nums ${
                      isActive ? "text-[#F5C518]" : "text-[#666666]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ---- Main Content ---- */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Toolbar: search + filters */}
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search tasks..."
              value={searchValue}
              onChange={(e) => setParam("search", e.target.value)}
              containerClassName="flex-1"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setParam("status", v)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(v) => setParam("priority", v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {capitalize(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setParam("category", v)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Category</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {capitalize(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              ) : paginatedTasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks found"
                  description="There are no tasks matching your current filters."
                  action={{ label: "Create Task", onClick: openCreate }}
                />
              ) : (
                paginatedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setDetailTask(task)}
                    className="flex items-center min-h-[56px] px-4 py-2 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors gap-3 cursor-pointer"
                  >
                    {/* Priority dot */}
                    <div className="w-3 flex justify-center shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                        title={capitalize(task.priority)}
                      />
                    </div>

                    {/* Star toggle */}
                    <div className="w-6 flex justify-center shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(task);
                        }}
                        className="p-0.5 rounded transition-colors cursor-pointer"
                        title={task.is_starred ? "Unstar" : "Star"}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            task.is_starred
                              ? "fill-[#F5C518] text-[#F5C518]"
                              : "text-[#666666] hover:text-[#F5C518]"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white truncate">
                          {task.title}
                        </span>
                        {task.checklist_total > 0 && (
                          <span className="text-[10px] text-[#666666] shrink-0">
                            [{task.checklist_done}/{task.checklist_total}]
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <span className="text-xs text-[#666666] block truncate">
                          {task.description.split("\n")[0]}
                        </span>
                      )}
                    </div>

                    {/* Project + phase badge */}
                    <div className="w-[120px] shrink-0">
                      {task.project_name ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="info"
                            className="text-[10px] px-2 py-0.5 truncate max-w-full"
                          >
                            {task.project_name}
                          </Badge>
                          {task.phase_name && (
                            <span className="text-[10px] text-[#666666] truncate">
                              {task.phase_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[13px] text-[#666666]">
                          &mdash;
                        </span>
                      )}
                    </div>

                    {/* Category badge */}
                    <div className="w-[90px] shrink-0">
                      <Badge
                        variant="draft"
                        className="text-[10px] px-2 py-0.5"
                      >
                        {capitalize(task.category)}
                      </Badge>
                    </div>

                    {/* Assignee */}
                    <div className="w-[80px] shrink-0 flex items-center">
                      {task.assigned_to_name ? (
                        <Avatar
                          initials={initials(task.assigned_to_name)}
                          size="sm"
                          color={avatarColor(task.assigned_to_name)}
                        />
                      ) : (
                        <span className="text-[13px] text-[#666666]">
                          &mdash;
                        </span>
                      )}
                    </div>

                    {/* Due date */}
                    <div className="w-[90px] shrink-0">
                      {task.due_date ? (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            isOverdue(task.due_date, task.status)
                              ? "text-red-500"
                              : "text-[#A0A0A0]"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.due_date)}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#666666]">
                          &mdash;
                        </span>
                      )}
                    </div>

                    {/* Status badge (clickable) */}
                    <div className="w-[100px] shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStatus(task);
                        }}
                        className="cursor-pointer"
                        title="Click to change status"
                      >
                        <Badge
                          variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}
                        >
                          {STATUS_LABEL[task.status] ?? task.status}
                        </Badge>
                      </button>
                    </div>

                    {/* Go to project */}
                    <div className="w-8 flex justify-center shrink-0">
                      {task.project_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/projects/${task.project_id}?highlightTask=${task.id}`
                            );
                          }}
                          className="p-1 rounded-md text-[#666666] hover:text-[#F5C518] hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                          title="Go to project"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="w-8 flex justify-end shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-md text-[#666666] hover:text-white hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleStar(task)}>
                            <Star
                              className={`w-4 h-4 ${task.is_starred ? "fill-[#F5C518] text-[#F5C518]" : ""}`}
                            />
                            {task.is_starred ? "Unstar" : "Star"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(task)}>
                            <Edit className="w-4 h-4" />
                            Edit Task
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(task)}>
                            <CheckCircle2 className="w-4 h-4" />
                            {task.status === "completed"
                              ? "Reopen"
                              : "Complete"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onClick={() => setDeleteTarget(task)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {!loading && tasks.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setParam("page", String(page))}
                showingText={`Showing ${startIdx + 1}–${endIdx} of ${tasks.length} tasks`}
              />
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Task Detail Modal                                                 */}
      {/* ================================================================= */}
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

      {/* ================================================================= */}
      {/* Create / Edit Task Dialog                                         */}
      {/* ================================================================= */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingTask(null);
            setFormData(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Title */}
            <Input
              label="Title"
              placeholder="Task title"
              value={formData.title}
              onChange={(e) =>
                setFormData((f) => ({ ...f, title: e.target.value }))
              }
              required
            />

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                Description
              </label>
              <textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none"
              />
            </div>

            {/* Project + Phase row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-text-secondary">
                  Project
                </label>
                <Select
                  value={formData.projectId || "none"}
                  onValueChange={(v) => {
                    const pid = v === "none" ? "" : v;
                    setFormData((f) => ({ ...f, projectId: pid, phaseId: "" }));
                    fetchPhases(pid);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-text-secondary">
                  Phase
                </label>
                <Select
                  value={formData.phaseId || "none"}
                  onValueChange={(v) =>
                    setFormData((f) => ({
                      ...f,
                      phaseId: v === "none" ? "" : v,
                    }))
                  }
                  disabled={!formData.projectId || loadingPhases}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingPhases ? "Loading..." : "No phase"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No phase</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority + Category row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-text-secondary">
                  Priority
                </label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, priority: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {capitalize(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-text-secondary">
                  Category
                </label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {capitalize(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assigned To */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                Assigned To
              </label>
              <Select
                value={formData.assignedTo || "none"}
                onValueChange={(v) =>
                  setFormData((f) => ({
                    ...f,
                    assignedTo: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user.name || m.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((f) => ({ ...f, dueDate: e.target.value }))
              }
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.title.trim()}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingTask ? (
                "Save Changes"
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Delete Confirmation Dialog                                         */}
      {/* ================================================================= */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete &ldquo;{deleteTarget?.title}&rdquo;?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            This will permanently delete this task. This action cannot be
            undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="danger" disabled={deleting} onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
