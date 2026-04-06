"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { avatarColor } from "@/lib/avatarUtils";
import { tasks as tasksApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import type { Task, TaskFormData } from "@/types";
import {
  PRIORITY_DOT,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  initials,
  isOverdue,
  formatDate,
  capitalize,
} from "@/lib/taskUtils";
import { useTaskCrud } from "@/hooks/useTaskCrud";
import { toast } from "@/components/ui/useToast";
import { TaskFormDialog } from "@/app/(dashboard)/tasks/_components/TaskFormDialog";
import { TaskDeleteDialog } from "@/app/(dashboard)/tasks/_components/TaskDeleteDialog";

interface TaskSectionProps {
  projectId: string;
  activePhaseId: string;
  highlightTaskId?: string | null;
  phases: { id: string; name: string }[];
  members: { user_id: string; user_name: string; user_email: string }[];
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
  const emptyForm: TaskFormData = useMemo(
    () => ({
      title: "",
      description: "",
      phaseId: activePhaseId,
      priority: "medium",
      category: "general",
      assignedTo: "",
      dueDate: "",
    }),
    [activePhaseId]
  );

  // -- Data state --
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // -- Fetch tasks --
  const fetchTasks = useCallback(async () => {
    try {
      const data = await tasksApi.list({
        projectId,
        limit: "100",
      });
      setAllTasks(data.tasks ?? []);
    } catch {
      setAllTasks([]);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  // -- CRUD hook --
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
    setTasks: setAllTasks,
    defaultForm: emptyForm,
    projectId,
  });

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
  const filteredTasks = useMemo(
    () => allTasks.filter((t) => t.phase_id === activePhaseId || !t.phase_id),
    [allTasks, activePhaseId]
  );

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
            {filteredTasks.length}
          </Badge>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Task list */}
      <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
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
            {/* Desktop table header */}
            <div className="hidden lg:flex items-center h-10 px-4 bg-bg-elevated gap-3">
              <div className="w-3" />
              <div className="w-6" />
              <div className="flex-1 text-xs font-bold text-text-muted">
                Task
              </div>
              <div className="w-[90px] text-xs font-bold text-text-muted">
                Category
              </div>
              <div className="w-[80px] text-xs font-bold text-text-muted">
                Assignee
              </div>
              <div className="w-[90px] text-xs font-bold text-text-muted">
                Due Date
              </div>
              <div className="w-[100px] text-xs font-bold text-text-muted">
                Status
              </div>
              <div className="w-8" />
            </div>

            {/* Table body */}
            {filteredTasks.map((task) => {
              const actionMenu = (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors cursor-pointer"
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
              );

              return (
                <div key={task.id} data-task-id={task.id}>
                  {/* Desktop row */}
                  <div className="hidden lg:flex items-center min-h-[52px] px-4 py-2 border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors gap-3">
                    <div className="w-3 flex justify-center shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                        title={capitalize(task.priority)}
                      />
                    </div>
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
                              ? "fill-accent text-accent"
                              : "text-text-muted hover:text-accent"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {task.title}
                        </span>
                        {task.checklist_total > 0 && (
                          <span className="text-[10px] text-text-muted shrink-0">
                            [{task.checklist_done}/{task.checklist_total}]
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <span className="text-xs text-text-muted block truncate">
                          {task.description.split("\n")[0]}
                        </span>
                      )}
                    </div>
                    <div className="w-[90px] shrink-0">
                      <Badge
                        variant="draft"
                        className="text-[10px] px-2 py-0.5"
                      >
                        {capitalize(task.category)}
                      </Badge>
                    </div>
                    <div className="w-[80px] shrink-0 flex items-center">
                      {task.assigned_to_name ? (
                        <Avatar
                          initials={initials(task.assigned_to_name)}
                          size="sm"
                          color={avatarColor(task.assigned_to_name)}
                        />
                      ) : (
                        <span className="text-[13px] text-text-muted">
                          &mdash;
                        </span>
                      )}
                    </div>
                    <div className="w-[90px] shrink-0">
                      {task.due_date ? (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            isOverdue(task.due_date, task.status)
                              ? "text-red-500"
                              : "text-text-secondary"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.due_date)}
                        </span>
                      ) : (
                        <span className="text-[13px] text-text-muted">
                          &mdash;
                        </span>
                      )}
                    </div>
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
                    <div className="w-8 flex justify-end shrink-0">
                      {actionMenu}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="flex flex-col gap-2 p-4 border-b border-border-default last:border-b-0 lg:hidden">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                      />
                      <span className="text-sm font-semibold text-text-primary truncate flex-1">
                        {task.title}
                      </span>
                      {task.checklist_total > 0 && (
                        <span className="text-[10px] text-text-muted shrink-0">
                          [{task.checklist_done}/{task.checklist_total}]
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(task);
                        }}
                        className="p-0.5 shrink-0 cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            task.is_starred
                              ? "fill-accent text-accent"
                              : "text-text-muted"
                          }`}
                        />
                      </button>
                      <div className="shrink-0">{actionMenu}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => toggleStatus(task)}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}
                        >
                          {STATUS_LABEL[task.status] ?? task.status}
                        </Badge>
                      </button>
                      <Badge
                        variant="draft"
                        className="text-[10px] px-2 py-0.5"
                      >
                        {capitalize(task.category)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      {task.assigned_to_name && (
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            initials={initials(task.assigned_to_name)}
                            size="xs"
                            color={avatarColor(task.assigned_to_name)}
                          />
                          <span className="truncate">
                            {task.assigned_to_name}
                          </span>
                        </div>
                      )}
                      {task.due_date && (
                        <span
                          className={`flex items-center gap-1 ml-auto ${
                            isOverdue(task.due_date, task.status)
                              ? "text-red-500"
                              : "text-text-secondary"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* View all link */}
      <div className="flex justify-center">
        <Link
          href={`/tasks?projectId=${projectId}`}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          View all tasks in Task Manager
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Create / Edit Task Dialog */}
      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingTask(null);
            setFormData(emptyForm);
          }
        }}
        editingTask={editingTask}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onSubmit={handleSubmit}
        phases={phases}
        members={members.map((m) => ({
          id: m.user_id,
          name: m.user_name,
          email: m.user_email,
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
