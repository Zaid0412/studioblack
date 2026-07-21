"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ISSUE_PURPOSES,
  ISSUE_PURPOSE_LABELS,
  type IssuePurpose,
} from "@/lib/validations";

interface IssueRevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label of the revision about to be created, e.g. `Rev 03`. */
  nextRevLabel: string;
  submitting: boolean;
  onIssue: (purpose: IssuePurpose) => void | Promise<void>;
}

/**
 * PM dialog for issuing the current version as the next official revision.
 * Picks the issue purpose; issuing marks the version read-only.
 */
export function IssueRevisionDialog({
  open,
  onOpenChange,
  nextRevLabel,
  submitting,
  onIssue,
}: IssueRevisionDialogProps) {
  const [purpose, setPurpose] = useState<IssuePurpose>("for_review");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Issue revision</DialogTitle>
          <DialogDescription>
            {nextRevLabel} — snapshots this version. Once issued it becomes
            read-only; new markup goes on the next version.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1">
          <label className="text-[12px] font-medium text-text-secondary">
            Issue purpose
          </label>
          <Select
            value={purpose}
            onValueChange={(v) => setPurpose(v as IssuePurpose)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {ISSUE_PURPOSE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={() => onIssue(purpose)} disabled={submitting}>
            <Upload className="w-4 h-4 mr-1.5" />
            {submitting ? "Issuing…" : "Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
