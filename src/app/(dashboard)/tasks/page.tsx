"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  ListTodo,
  User,
  PenLine,
  Star,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { toast } from "@/components/ui/useToast";
import { avatarColor } from "@/lib/avatarUtils";
import { authClient } from "@/lib/authClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  org_id: string;
  project_id: string | null;
  phase_id: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "completed" | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_name: string | null;
  created_by_name: string;
  project_name: string | null;
}

interface TaskCounts {
  all: number;
  my_tasks: number;
  created_by_me: number;
  important: number;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Bucket =
  | "all"
  | "my_tasks"
  | "created_by_me"
  | "important"
  | "upcoming"
  | "completed";

const BUCKETS: { key: Bucket; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All", icon: ListTodo },
  { key: "my_tasks", label: "My Tasks", icon: User },
  { key: "created_by_me", label: "Created by Me", icon: PenLine },
  { key: "important", label: "Important", icon: Star },
  { key: "upcoming", label: "Upcoming", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const STATUSES = ["todo", "in_progress", "completed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const CATEGORIES = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
] as const;

const PAGE_SIZE = 15;

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

const STATUS_BADGE_VARIANT: Record<
  string,
  "draft" | "warning" | "success" | "archived"
> = {
  todo: "draft",
  in_progress: "warning",
  completed: "success",
  archived: "archived",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

const NEXT_STATUS: Record<string, "todo" | "in_progress" | "completed"> = {
  todo: "in_progress",
  in_progress: "completed",
  completed: "todo",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

interface TaskFormData {
  title: string;
  description: string;
  projectId: string;
  priority: string;
  category: string;
  assignedTo: string;
  dueDate: string;
}

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  projectId: "",
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
    important: 0,
    upcoming: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // -- Filter state (from URL) --
  const activeBucket = (searchParams.get("bucket") as Bucket) || "all";
  const searchValue = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const priorityFilter = searchParams.get("priority") || "all";
  const categoryFilter = searchParams.get("category") || "all";
  const projectFilter = searchParams.get("projectId") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  // -- Dialog state --
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // -- Delete dialog --
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const params = new URLSearchParams();
      params.set("bucket", activeBucket);
      if (searchValue) params.set("search", searchValue);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (projectFilter !== "all") params.set("projectId", projectFilter);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
        setCounts(
          data.counts ?? {
            all: 0,
            my_tasks: 0,
            created_by_me: 0,
            important: 0,
            upcoming: 0,
            completed: 0,
          }
        );
      }
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
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(
            (Array.isArray(data) ? data : []).map(
              (p: { id: string; name: string }) => ({
                id: p.id,
                name: p.name,
              })
            )
          );
        }
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

  // -- Pagination --
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, tasks.length);
  const paginatedTasks = tasks.slice(startIdx, endIdx);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }, [totalPages]);

  // -- Quick status toggle --
  async function toggleStatus(task: Task) {
    const newStatus = NEXT_STATUS[task.status] ?? "todo";
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch {
      /* ignore */
    }
  }

  // -- Create / Edit submit --
  async function handleSubmit() {
    if (!formData.title.trim()) return;
    setSubmitting(true);

    const body: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      projectId: formData.projectId || undefined,
      priority: formData.priority,
      category: formData.category,
      assignedTo: formData.assignedTo || undefined,
      dueDate: formData.dueDate || undefined,
    };

    try {
      const isEdit = !!editingTask;
      const url = isEdit ? `/api/tasks/${editingTask!.id}` : "/api/tasks";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: isEdit ? "Task updated" : "Task created",
          description: isEdit
            ? `"${formData.title}" has been updated.`
            : `"${formData.title}" has been created.`,
          variant: "success",
        });
        setDialogOpen(false);
        setEditingTask(null);
        setFormData(EMPTY_FORM);
        fetchTasks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description:
            data.error || `Failed to ${isEdit ? "update" : "create"} task`,
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // -- Delete --
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({
          title: "Task deleted",
          description: `"${deleteTarget.title}" has been deleted.`,
          variant: "success",
        });
        setDeleteTarget(null);
        fetchTasks();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete task",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  // -- Open edit dialog --
  function openEdit(task: Task) {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      projectId: task.project_id || "",
      priority: task.priority,
      category: task.category,
      assignedTo: task.assigned_to || "",
      dueDate: task.due_date ? task.due_date.split("T")[0] : "",
    });
    setDialogOpen(true);
  }

  // -- Open create dialog --
  function openCreate() {
    setEditingTask(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <PageHeader
        title="Task Manager"
        subtitle="Manage and track tasks across all projects"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            New Task
          </Button>
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
                    className="flex items-center min-h-[56px] px-4 py-2 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors gap-3"
                  >
                    {/* Priority dot */}
                    <div className="w-3 flex justify-center shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                        title={capitalize(task.priority)}
                      />
                    </div>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white block truncate">
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-xs text-[#666666] block truncate">
                          {task.description.split("\n")[0]}
                        </span>
                      )}
                    </div>

                    {/* Project badge */}
                    <div className="w-[120px] shrink-0">
                      {task.project_name ? (
                        <Badge
                          variant="info"
                          className="text-[10px] px-2 py-0.5 truncate max-w-full"
                        >
                          {task.project_name}
                        </Badge>
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
                            isOverdue(task.due_date) &&
                            task.status !== "completed"
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
                        onClick={() => toggleStatus(task)}
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
              <div className="flex items-center justify-between h-12 px-4 border-t border-[#333333]">
                <span className="text-[13px] text-[#666666]">
                  Showing {startIdx + 1}–{endIdx} of {tasks.length} tasks
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setParam("page", String(Math.max(1, currentPage - 1)))
                    }
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-[#2A2A2A] text-[#666666] disabled:opacity-40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {pageNumbers.map((num) => (
                    <button
                      key={num}
                      onClick={() => setParam("page", String(num))}
                      className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors cursor-pointer ${
                        num === currentPage
                          ? "bg-[#F5C518] text-[#0D0D0D] font-semibold"
                          : "bg-[#2A2A2A] text-[#A0A0A0] hover:text-white"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setParam(
                        "page",
                        String(Math.min(totalPages, currentPage + 1))
                      )
                    }
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-[#2A2A2A] text-[#666666] disabled:opacity-40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

            {/* Project */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                Project
              </label>
              <Select
                value={formData.projectId || "none"}
                onValueChange={(v) =>
                  setFormData((f) => ({
                    ...f,
                    projectId: v === "none" ? "" : v,
                  }))
                }
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
