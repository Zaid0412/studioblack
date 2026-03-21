"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PRIORITIES, CATEGORIES, capitalize } from "@/lib/taskUtils";
import type { Task, TaskFormData } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberOption {
  id: string;
  name: string;
  email: string;
}

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: Task | null;
  formData: TaskFormData;
  setFormData: React.Dispatch<React.SetStateAction<TaskFormData>>;
  submitting: boolean;
  onSubmit: () => void;
  // Project/phase options
  projects?: { id: string; name: string }[];
  phases: { id: string; name: string }[];
  loadingPhases?: boolean;
  onProjectChange?: (projectId: string) => void;
  // Members for assignment
  members: MemberOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 *
 */
export function TaskFormDialog({
  open,
  onOpenChange,
  editingTask,
  formData,
  setFormData,
  submitting,
  onSubmit,
  projects,
  phases,
  loadingPhases,
  onProjectChange,
  members,
}: TaskFormDialogProps) {
  const showProjectSelector = !!projects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Project + Phase row (when projects provided) or Phase only */}
          {showProjectSelector ? (
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
                    onProjectChange?.(pid);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects!.map((p) => (
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
          ) : (
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
          )}

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
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.email}
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
            onClick={onSubmit}
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
  );
}
