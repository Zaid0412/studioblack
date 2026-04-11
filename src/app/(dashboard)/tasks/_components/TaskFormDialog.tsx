"use client";

import { useState, useRef, useCallback } from "react";
import {
  Loader2,
  ListChecks,
  Paperclip,
  X,
  CloudUpload,
  Check,
} from "lucide-react";
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
import {
  getFileExtension,
  fileTypeBadge,
  formatFileSize,
  MAX_UPLOAD_SIZE,
} from "@/lib/fileUtils";
import { toast } from "@/components/ui/useToast";
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

/** Dialog form for creating or editing a task. */
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
  const isCreate = !editingTask;

  // -- Checklist local state --
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const addChecklistItem = useCallback(() => {
    const title = newChecklistItem.trim();
    if (!title) return;
    setFormData((f) => ({
      ...f,
      checklistItems: [...f.checklistItems, title],
    }));
    setNewChecklistItem("");
  }, [newChecklistItem, setFormData]);

  const removeChecklistItem = useCallback(
    (index: number) => {
      setFormData((f) => ({
        ...f,
        checklistItems: f.checklistItems.filter((_, i) => i !== index),
      }));
    },
    [setFormData]
  );

  // -- File attachment local state --
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const tooLarge = incoming.filter((f) => f.size > MAX_UPLOAD_SIZE);
      if (tooLarge.length > 0) {
        toast({
          title: "File too large",
          description: `${tooLarge.map((f) => f.name).join(", ")} exceed${tooLarge.length === 1 ? "s" : ""} the 50 MB limit.`,
          variant: "error",
        });
      }

      const valid = incoming.filter((f) => f.size <= MAX_UPLOAD_SIZE);
      if (valid.length === 0) return;
      setFormData((f) => ({
        ...f,
        pendingFiles: [...f.pendingFiles, ...valid],
      }));
    },
    [setFormData]
  );

  const removeFile = useCallback(
    (index: number) => {
      setFormData((f) => ({
        ...f,
        pendingFiles: f.pendingFiles.filter((_, i) => i !== index),
      }));
    },
    [setFormData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 min-h-0 px-4">
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

          {/* Assigned To + Due Date row */}
          <div className="grid grid-cols-2 gap-3">
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
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((f) => ({ ...f, dueDate: e.target.value }))
              }
            />
          </div>

          {/* ---- Checklist Section (create mode only) ---- */}
          {isCreate && (
            <>
              <div className="border-t border-border-default" />
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                      Checklist
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted">Optional</span>
                </div>

                {/* Add item input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addChecklistItem();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Add item..."
                    className="flex-1 text-[13px] bg-transparent border border-border-default rounded-md px-2.5 py-1.5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newChecklistItem.trim()}
                    className="px-3 py-1.5 rounded-md bg-accent text-black text-xs font-semibold disabled:opacity-30 hover:bg-accent/90 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </form>

                {/* Checklist items */}
                {formData.checklistItems.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {formData.checklistItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 py-1.5 px-2 rounded group hover:bg-bg-elevated/50"
                      >
                        <div className="w-4 h-4 rounded-[3px] border-[1.5px] border-text-muted shrink-0 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-transparent" />
                        </div>
                        <span className="flex-1 text-[13px] text-text-primary truncate">
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(i)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---- Attachments Section (create mode only) ---- */}
          {isCreate && (
            <>
              <div className="border-t border-border-default" />
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                      Attachments
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted">Optional</span>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border border-dashed cursor-pointer transition-colors ${
                    dragOver
                      ? "border-accent bg-accent/5"
                      : "border-border-default hover:border-text-muted"
                  }`}
                >
                  <CloudUpload className="w-5 h-5 text-text-muted" />
                  <p className="text-[13px] text-text-muted">
                    Drop files here or{" "}
                    <span className="font-medium text-accent">browse</span>
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                {/* File list */}
                {formData.pendingFiles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {formData.pendingFiles.map((file, i) => {
                      const ext = getFileExtension(file.name);
                      const badge = fileTypeBadge(ext);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-md bg-bg-elevated/50 group"
                        >
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span className="flex-1 text-[13px] text-text-primary truncate">
                            {file.name}
                          </span>
                          <span className="text-[11px] text-text-muted shrink-0">
                            {formatFileSize(file.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="p-0.5 rounded text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
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
