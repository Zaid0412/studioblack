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
  const t = useTranslations("organisation");

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaveTitle")}</DialogTitle>
          <DialogDescription>
            {t("leaveDescription", { orgName })}
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
            {isLeaving ? t("leaving") : t("leaveTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
