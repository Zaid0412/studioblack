"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  isLeaving: boolean;
  onLeave: () => void;
}

/** Confirmation dialog for leaving the current organisation. */
export function LeaveDialog({
  open,
  onOpenChange,
  orgName,
  isLeaving,
  onLeave,
}: LeaveDialogProps) {
  const tc = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave Organisation</DialogTitle>
          <DialogDescription>
            Are you sure you want to leave {orgName}? You will lose access to
            all projects and data in this organisation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLeaving}
          >
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onLeave}
            disabled={isLeaving}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLeaving ? "Leaving..." : "Leave Organisation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
