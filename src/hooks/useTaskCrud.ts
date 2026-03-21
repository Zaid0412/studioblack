import { useState, useCallback } from "react";
import { tasks as tasksApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { NEXT_STATUS } from "@/lib/taskUtils";
import type { Task, TaskFormData } from "@/types";

interface UseTaskCrudOptions {
  fetchTasks: () => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setCounts?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  defaultForm: TaskFormData;
  projectId?: string;
  onFetchPhases?: (projectId: string) => void;
}

/**
 *
 */
export function useTaskCrud({
  fetchTasks,
  setTasks,
  setCounts,
  defaultForm,
  projectId,
  onFetchPhases,
}: UseTaskCrudOptions) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleStatus = useCallback(
    async (task: Task) => {
      const newStatus = NEXT_STATUS[task.status] ?? "todo";
      try {
        await tasksApi.update(task.id, { status: newStatus });
        fetchTasks();
      } catch {
        toast({
          title: "Error",
          description: "Failed to update status",
          variant: "error",
        });
      }
    },
    [fetchTasks]
  );

  const toggleStar = useCallback(
    async (task: Task) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, is_starred: !t.is_starred } : t
        )
      );
      setCounts?.((prev) => ({
        ...prev,
        starred: (prev.starred ?? 0) + (task.is_starred ? -1 : 1),
      }));
      try {
        await tasksApi.toggleStar(task.id);
      } catch {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, is_starred: task.is_starred } : t
          )
        );
        setCounts?.((prev) => ({
          ...prev,
          starred: (prev.starred ?? 0) + (task.is_starred ? 1 : -1),
        }));
      }
    },
    [setTasks, setCounts]
  );

  const handleSubmit = useCallback(async () => {
    if (!formData.title.trim()) return;
    setSubmitting(true);

    const body: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      projectId: projectId || formData.projectId || undefined,
      phaseId: formData.phaseId || undefined,
      priority: formData.priority,
      category: formData.category,
      assignedTo: formData.assignedTo || undefined,
      dueDate: formData.dueDate || undefined,
    };

    try {
      const isEdit = !!editingTask;
      if (isEdit) {
        await tasksApi.update(editingTask!.id, body);
      } else {
        await tasksApi.create(body as Parameters<typeof tasksApi.create>[0]);
      }

      toast({
        title: isEdit ? "Task updated" : "Task created",
        description: isEdit
          ? `"${formData.title}" has been updated.`
          : `"${formData.title}" has been created.`,
        variant: "success",
      });
      setDialogOpen(false);
      setEditingTask(null);
      setFormData(defaultForm);
      fetchTasks();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingTask, projectId, defaultForm, fetchTasks]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tasksApi.remove(deleteTarget.id);
      toast({
        title: "Task deleted",
        description: `"${deleteTarget.title}" has been deleted.`,
        variant: "success",
      });
      setDeleteTarget(null);
      fetchTasks();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchTasks]);

  const openEdit = useCallback(
    (task: Task) => {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        projectId: task.project_id || "",
        phaseId: task.phase_id || defaultForm.phaseId || "",
        priority: task.priority,
        category: task.category,
        assignedTo: task.assigned_to || "",
        dueDate: task.due_date ? task.due_date.split("T")[0] : "",
      });
      if (task.project_id && onFetchPhases) onFetchPhases(task.project_id);
      setDialogOpen(true);
    },
    [defaultForm.phaseId, onFetchPhases]
  );

  const openCreate = useCallback(() => {
    setEditingTask(null);
    setFormData(defaultForm);
    setDialogOpen(true);
  }, [defaultForm]);

  return {
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
  };
}
