"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Star,
  X,
  ListChecks,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { avatarColor } from "@/lib/avatarUtils";

// ---------------------------------------------------------------------------
// Types (mirrored from parent)
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
  checklist_total: number;
  checklist_done: number;
}

interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onToggleStar?: (task: Task) => void;
  onDelete: (task: Task) => void;
  onChecklistChange?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-blue-500",
  in_progress: "bg-yellow-500",
  completed: "bg-green-500",
  archived: "bg-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFullDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "completed") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center h-9 px-3.5 gap-0">
      <span className="text-xs text-[#666666] w-[90px] shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

function DetailSep() {
  return <div className="h-px bg-[#222222]" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Read-only task detail modal with action buttons. */
export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onEdit,
  onToggleStatus,
  onToggleStar,
  onDelete,
  onChecklistChange,
}: TaskDetailModalProps) {
  const router = useRouter();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const fetchChecklist = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`);
      if (res.ok) setChecklistItems(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open && task?.id) {
      fetchChecklist(task.id);
    } else {
      setChecklistItems([]);
      setNewItemTitle("");
    }
  }, [open, task?.id, fetchChecklist]);

  const addItem = async () => {
    if (!task || !newItemTitle.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newItemTitle.trim() }),
      });
      if (res.ok) {
        const item = await res.json();
        setChecklistItems((prev) => [...prev, item]);
        setNewItemTitle("");
        onChecklistChange?.();
      }
    } catch {
      // ignore
    } finally {
      setAddingItem(false);
    }
  };

  const toggleItem = async (item: ChecklistItem) => {
    if (!task) return;
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i))
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: !item.is_done }),
      });
      if (!res.ok) {
        setChecklistItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_done: item.is_done } : i
          )
        );
      } else {
        onChecklistChange?.();
      }
    } catch {
      setChecklistItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_done: item.is_done } : i
        )
      );
    }
  };

  const deleteItem = async (item: ChecklistItem) => {
    if (!task) return;
    setChecklistItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        fetchChecklist(task.id);
      } else {
        onChecklistChange?.();
      }
    } catch {
      fetchChecklist(task.id);
    }
  };

  if (!task) return null;

  const doneCount = checklistItems.filter((i) => i.is_done).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
              title={PRIORITY_LABEL[task.priority]}
            />
            <DialogTitle className="text-base font-semibold flex-1">
              {task.title}
            </DialogTitle>
            {onToggleStar && (
              <button
                onClick={() => onToggleStar(task)}
                className="p-1 rounded transition-colors cursor-pointer"
                title={task.is_starred ? "Unstar" : "Star"}
              >
                <Star
                  className={`w-[18px] h-[18px] ${
                    task.is_starred
                      ? "fill-[#F5C518] text-[#F5C518]"
                      : "text-[#666666] hover:text-[#F5C518]"
                  }`}
                />
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="h-px bg-[#333333]" />

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-4">
          {/* Description */}
          {task.description ? (
            <p className="text-[13px] text-[#A0A0A0] whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          ) : (
            <p className="text-[13px] text-[#666666] italic">No description</p>
          )}

          {/* Details card */}
          <div className="flex flex-col rounded-lg bg-[#151515] overflow-hidden">
            <DetailRow label="Status">
              <span
                className={`w-[7px] h-[7px] rounded-full ${STATUS_DOT[task.status] ?? "bg-gray-400"}`}
              />
              <span className="text-xs font-medium text-white">
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </DetailRow>
            <DetailSep />
            <DetailRow label="Priority">
              <span
                className={`w-[7px] h-[7px] rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
              />
              <span className="text-xs font-medium text-white">
                {PRIORITY_LABEL[task.priority]}
              </span>
            </DetailRow>
            <DetailSep />
            <DetailRow label="Project">
              {task.project_name ? (
                <a
                  href={`/projects/${task.project_id}?highlightTask=${task.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-500/20 transition-colors"
                >
                  {task.project_name}
                </a>
              ) : (
                <span className="text-xs text-[#666666]">&mdash;</span>
              )}
            </DetailRow>
            <DetailSep />
            <DetailRow label="Phase">
              {task.phase_name ? (
                <span className="text-xs text-[#A0A0A0]">
                  {task.phase_name}
                </span>
              ) : (
                <span className="text-xs text-[#666666]">&mdash;</span>
              )}
            </DetailRow>
            <DetailSep />
            <DetailRow label="Category">
              <span className="text-[11px] font-medium text-[#A0A0A0] bg-[#222222] px-2 py-0.5 rounded">
                {capitalize(task.category)}
              </span>
            </DetailRow>
            <DetailSep />
            <DetailRow label="Assignee">
              {task.assigned_to_name ? (
                <>
                  <Avatar
                    initials={initials(task.assigned_to_name)}
                    size="sm"
                    color={avatarColor(task.assigned_to_name)}
                  />
                  <span className="text-xs text-white">
                    {task.assigned_to_name}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#666666]">Unassigned</span>
              )}
            </DetailRow>
            <DetailSep />
            <DetailRow label="Due">
              {task.due_date ? (
                <>
                  <Calendar className="w-3.5 h-3.5 text-[#A0A0A0]" />
                  <span
                    className={`text-xs ${
                      isOverdue(task.due_date, task.status)
                        ? "text-red-500"
                        : "text-[#A0A0A0]"
                    }`}
                  >
                    {formatFullDate(task.due_date)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#666666]">&mdash;</span>
              )}
            </DetailRow>
            <DetailSep />
            <DetailRow label="Created">
              <span className="text-xs text-[#555555]">
                {formatFullDate(task.created_at)} by {task.created_by_name}
              </span>
            </DetailRow>
            {task.completed_at && (
              <>
                <DetailSep />
                <DetailRow label="Completed">
                  <span className="text-xs text-green-400">
                    {formatFullDate(task.completed_at)}
                  </span>
                </DetailRow>
              </>
            )}
          </div>

          {/* Checklist */}
          <div className="flex flex-col gap-2.5 border-t border-[#333333] pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-[#666666]" />
                <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Checklist
                </span>
              </div>
              {checklistItems.length > 0 && (
                <span className="text-[11px] text-[#666666]">
                  {doneCount}/{checklistItems.length} completed
                </span>
              )}
            </div>
            {checklistItems.length > 0 && (
              <div className="w-full h-[3px] rounded-full bg-[#333333] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#F5C518] transition-all duration-200"
                  style={{
                    width: `${(doneCount / checklistItems.length) * 100}%`,
                  }}
                />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 group py-1.5 px-1 rounded hover:bg-white/[0.02]"
                >
                  <button
                    onClick={() => toggleItem(item)}
                    className={`w-4 h-4 rounded-[3px] border shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                      item.is_done
                        ? "bg-[#F5C518] border-[#F5C518]"
                        : "border-[#666666] hover:border-[#A0A0A0]"
                    }`}
                  >
                    {item.is_done && (
                      <svg
                        className="w-3 h-3 text-black"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`text-[13px] flex-1 ${
                      item.is_done
                        ? "text-[#666666] line-through"
                        : "text-[#A0A0A0]"
                    }`}
                  >
                    {item.title}
                  </span>
                  <button
                    onClick={() => deleteItem(item)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#666666] hover:text-red-400 transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addItem();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Add item..."
                className="flex-1 text-[13px] bg-transparent border border-[#333333] rounded px-2.5 py-1.5 text-white placeholder:text-[#666666] outline-none focus:border-[#F5C518] transition-colors"
                disabled={addingItem}
              />
              <button
                type="submit"
                disabled={!newItemTitle.trim() || addingItem}
                className="px-3 py-1.5 rounded bg-[#F5C518] text-black text-xs font-semibold disabled:opacity-30 hover:bg-[#F5C518]/90 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="h-px bg-[#333333]" />
        <DialogFooter className="flex-row justify-between sm:justify-between px-6 py-3">
          <div className="flex gap-2">
            {task.project_id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  router.push(
                    `/projects/${task.project_id}?highlightTask=${task.id}`
                  );
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Go to Project
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(task);
              }}
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggleStatus(task)}
            >
              {task.status === "completed" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5" />
                  Reopen
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete
                </>
              )}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onDelete(task);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
