import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { tasks as tasksApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { NEXT_STATUS } from "@/lib/taskUtils";
import type { Task, TaskStatus } from "@/types";

interface UseTaskCrudOptions {
  /** Called after a write to revalidate the list. */
  fetchTasks: () => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

/**
 * Row-level CRUD helpers for the task list — the create/edit form lives at
 * `/tasks/new` and `/tasks/[id]` now, so this hook only carries delete +
 * status toggle + star toggle, plus an `openEdit` that routes to the full
 * page rather than opening a dialog.
 */
export function useTaskCrud({ fetchTasks, setTasks }: UseTaskCrudOptions) {
  const router = useRouter();
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

  /**
   * Set a task's status directly (no cycling). Used by the row's "Complete"
   * / "Reopen" menu item, where the user expects an explicit transition
   * regardless of the current state. The status-pill button still uses
   * `toggleStatus` for the cycle UX.
   */
  const setStatus = useCallback(
    async (task: Task, status: TaskStatus) => {
      try {
        await tasksApi.update(task.id, { status });
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
      try {
        await tasksApi.toggleStar(task.id);
      } catch {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, is_starred: task.is_starred } : t
          )
        );
      }
    },
    [setTasks]
  );

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

  // Edit happens on the task page, where every field is inline-editable.
  const openEdit = useCallback(
    (task: Task) => {
      router.push(`/tasks/${task.id}`);
    },
    [router]
  );

  return {
    deleteTarget,
    setDeleteTarget,
    deleting,
    toggleStatus,
    setStatus,
    toggleStar,
    handleDelete,
    openEdit,
  };
}
