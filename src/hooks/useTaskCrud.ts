import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { tasks as tasksApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { NEXT_STATUS } from "@/lib/taskUtils";
import type { Task } from "@/types";

interface UseTaskCrudOptions {
  /** Called after a write to revalidate the list. */
  fetchTasks: () => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  /** Optional bucket-counts setter for optimistic star toggle. */
  setCounts?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

/**
 * Row-level CRUD helpers for the task list — the create/edit form lives at
 * `/tasks/new` and `/tasks/[id]` now, so this hook only carries delete +
 * status toggle + star toggle, plus an `openEdit` that routes to the full
 * page rather than opening a dialog.
 */
export function useTaskCrud({
  fetchTasks,
  setTasks,
  setCounts,
}: UseTaskCrudOptions) {
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
    toggleStar,
    handleDelete,
    openEdit,
  };
}
