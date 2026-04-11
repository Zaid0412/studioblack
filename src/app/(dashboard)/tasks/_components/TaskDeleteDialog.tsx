"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("tasks");
  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("deleteTitle", { title: task?.title ?? "" })}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-secondary">{t("deleteDescription")}</p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t("cancel")}</Button>
          </DialogClose>
          <Button variant="danger" disabled={deleting} onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
            {deleting ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
