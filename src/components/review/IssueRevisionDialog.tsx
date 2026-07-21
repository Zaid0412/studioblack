"use client";

import { useState } from "react";
import { Stamp, CircleDot, History, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
  /** Drawing/file being issued — shown in the header. */
  fileName: string;
  /** Label of the revision about to be created, e.g. `Rev 01`. */
  nextRevLabel: string;
  /** True when this drawing has never been issued (first revision). */
  isFirstIssue: boolean;
  /** The revision this one supersedes, e.g. `Rev 01` (null on first issue). */
  currentRevLabel: string | null;
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
  fileName,
  nextRevLabel,
  isFirstIssue,
  currentRevLabel,
  submitting,
  onIssue,
}: IssueRevisionDialogProps) {
  const [purpose, setPurpose] = useState<IssuePurpose>("for_review");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border-default px-5 py-4 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15">
            <Stamp className="h-[18px] w-[18px] text-accent" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-[15px] font-bold">
              Issue revision
            </DialogTitle>
            <DialogDescription className="truncate text-[11.5px] text-text-muted">
              {fileName}
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-5">
          {/* What's being created */}
          <div className="flex items-center justify-between rounded-[10px] border border-accent/25 bg-accent/10 px-4 py-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-text-secondary">
                You&apos;re issuing
              </span>
              <span className="text-[22px] font-bold leading-none text-text-primary">
                {nextRevLabel}
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary">
              {isFirstIssue ? (
                <>
                  <CircleDot className="h-3 w-3" />
                  First issue
                </>
              ) : (
                <>
                  <History className="h-3 w-3" />
                  Supersedes {currentRevLabel}
                </>
              )}
            </span>
          </div>

          {/* Purpose */}
          <div className="flex flex-col gap-1.5">
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

          {/* Consequence */}
          <div className="flex items-start gap-2">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-text-muted" />
            <p className="text-[11.5px] leading-relaxed text-text-muted">
              This version becomes read-only after issuing. New markup goes on
              the next version.
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2 border-t border-border-default bg-bg-primary/25 px-5 py-3.5">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={() => onIssue(purpose)} disabled={submitting}>
            <Stamp className="mr-1.5 h-4 w-4" />
            {submitting ? "Issuing…" : `Issue ${nextRevLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
