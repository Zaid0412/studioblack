"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import type { Task } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskDeleteDialogProps {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Confirmation dialog for permanently deleting a task. */
export function TaskDeleteDialog({
  task,
  onOpenChange,
  deleting,
  onDelete,
}: TaskDeleteDialogProps) {
  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{task?.title}&rdquo;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-secondary">
          This will permanently delete this task. This action cannot be undone.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="danger" disabled={deleting} onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
