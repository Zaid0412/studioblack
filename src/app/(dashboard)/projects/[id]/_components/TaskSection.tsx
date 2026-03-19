"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  CheckSquare,
  ArrowRight,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

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
  phase_name: string | null;
  is_starred: boolean;
}

interface TaskSectionProps {
  projectId: string;
  activePhaseId: string;
  highlightTaskId?: string | null;
  phases: { id: string; name: string }[];
  members: { user_id: string; user_name: string; user_email: string }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const CATEGORIES = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
] as const;

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
// Form state
// ---------------------------------------------------------------------------

interface TaskFormData {
  title: string;
  description: string;
  phaseId: string;
  priority: string;
  category: string;
  assignedTo: string;
  dueDate: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Task list section for a project detail page with inline CRUD. */
export function TaskSection({
  projectId,
  activePhaseId,
  highlightTaskId,
  phases,
  members,
}: TaskSectionProps) {
  const emptyForm: TaskFormData = {
    title: "",
    description: "",
    phaseId: activePhaseId,
    priority: "medium",
    category: "general",
    assignedTo: "",
    dueDate: "",
  };

  // -- Data state --
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // -- Dialog state --
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // -- Delete dialog --
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  // -- Fetch tasks --
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setAllTasks(data.tasks ?? []);
      }
    } catch {
      setAllTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  // -- Highlight task from URL --
  useEffect(() => {
    if (!highlightTaskId || loading) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${highlightTaskId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("task-highlight-glow");
        setTimeout(() => el.classList.remove("task-highlight-glow"), 2500);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightTaskId, loading]);

  // -- Filter by active phase (client-side) --
  const filteredTasks = allTasks.filter(
    (t) => t.phase_id === activePhaseId || !t.phase_id
  );

  // -- Quick status toggle --
  async function toggleStatus(task: Task) {
    const newStatus = NEXT_STATUS[task.status] ?? "todo";
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchTasks();
    } catch {
      /* ignore */
    }
  }

  // -- Star toggle --
  async function toggleStar(task: Task) {
    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, is_starred: !t.is_starred } : t
      )
    );
    try {
      await fetch(`/api/tasks/${task.id}/star`, { method: "POST" });
    } catch {
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, is_starred: task.is_starred } : t
        )
      );
    }
  }

  // -- Create / Edit submit --
  async function handleSubmit() {
    if (!formData.title.trim()) return;
    setSubmitting(true);

    const body: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      projectId,
      phaseId: formData.phaseId || undefined,
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
        setFormData(emptyForm);
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
      phaseId: task.phase_id || activePhaseId,
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
    setFormData({ ...emptyForm, phaseId: activePhaseId });
    setDialogOpen(true);
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[#A0A0A0]" />
          <h2 className="text-base font-semibold text-white">Tasks</h2>
          <Badge variant="draft" className="text-[10px] px-2 py-0.5">
            {filteredTasks.length}
          </Badge>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Task list */}
      <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Create a task to get started."
            action={{ label: "Create Task", onClick: openCreate }}
          />
        ) : (
          <>
            {/* Table header */}
            <div className="flex items-center h-10 px-4 bg-[#242424] gap-3">
              <div className="w-3" />
              <div className="w-6" />
              <div className="flex-1 text-xs font-bold text-[#666666]">
                Task
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
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                data-task-id={task.id}
                className="flex items-center min-h-[52px] px-4 py-2 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors gap-3"
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
                      className={`w-3.5 h-3.5 ${
                        task.is_starred
                          ? "fill-[#F5C518] text-[#F5C518]"
                          : "text-[#666666] hover:text-[#F5C518]"
                      }`}
                    />
                  </button>
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

                {/* Category badge */}
                <div className="w-[90px] shrink-0">
                  <Badge variant="draft" className="text-[10px] px-2 py-0.5">
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
                    <span className="text-[13px] text-[#666666]">&mdash;</span>
                  )}
                </div>

                {/* Due date */}
                <div className="w-[90px] shrink-0">
                  {task.due_date ? (
                    <span
                      className={`flex items-center gap-1 text-xs ${
                        isOverdue(task.due_date) && task.status !== "completed"
                          ? "text-red-500"
                          : "text-[#A0A0A0]"
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.due_date)}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[#666666]">&mdash;</span>
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
                        {task.status === "completed" ? "Reopen" : "Complete"}
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
            ))}
          </>
        )}
      </div>

      {/* View all link */}
      <div className="flex justify-center">
        <Link
          href={`/tasks?projectId=${projectId}`}
          className="flex items-center gap-1.5 text-sm text-[#A0A0A0] hover:text-[#F5C518] transition-colors"
        >
          View all tasks in Task Manager
          <ArrowRight className="w-4 h-4" />
        </Link>
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
            setFormData(emptyForm);
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

            {/* Phase */}
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
              >
                <SelectTrigger>
                  <SelectValue placeholder="No phase" />
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
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_name || m.user_email}
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
