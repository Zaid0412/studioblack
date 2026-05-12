"use client";

import { useState } from "react";
import { AlertTriangle, Inbox, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BoqSection } from "@/types";

interface BoqDeleteSectionDialogProps {
  /** Non-null = open with this target; null = closed. */
  target: BoqSection | null;
  /** Number of items currently in the target section. */
  itemCount: number;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user confirms.
   * - `cascade: false` → delete section only; items reflow to Unassigned.
   * - `cascade: true`  → delete section AND all its items.
   */
  onConfirm: (cascade: boolean) => Promise<void> | void;
  submitting?: boolean;
}

/**
 * Two-phase confirm dialog for section deletion.
 *
 * Phase A — choice (only when the section has items):
 *   "Move items to Unassigned" (safe) or "Delete section + items" (destructive).
 *   Empty sections skip this phase and show a single confirm.
 *
 * Phase B — type-to-confirm gate. Destructive button stays disabled until
 *   the user types DELETE exactly. Mirrors the GitHub / Vercel pattern for
 *   irreversible destructive actions.
 *
 * Internal state (phase + typed) is owned by `Body`. A `key={target.id}`
 * on `Body` resets it whenever the target changes — no useEffect needed.
 */
export function BoqDeleteSectionDialog({
  target,
  itemCount,
  onOpenChange,
  onConfirm,
  submitting,
}: BoqDeleteSectionDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {target && (
          <Body
            key={target.id}
            target={target}
            itemCount={itemCount}
            onConfirm={onConfirm}
            submitting={submitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Phase = "choice" | "cascade-confirm";

function Body({
  target,
  itemCount,
  onConfirm,
  submitting,
}: {
  target: BoqSection;
  itemCount: number;
  onConfirm: (cascade: boolean) => Promise<void> | void;
  submitting?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("choice");
  const [typed, setTyped] = useState("");

  const empty = itemCount === 0;
  const cascadeUnlocked = typed === "DELETE";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-error shrink-0" />
          {phase === "cascade-confirm"
            ? `Delete "${target.title}" + ${itemCount} item${itemCount === 1 ? "" : "s"}?`
            : `Delete "${target.title}"?`}
        </DialogTitle>
        <DialogDescription>
          {empty ? (
            <>This section has no items. It will be removed from the BOQ.</>
          ) : phase === "choice" ? (
            <>
              This section has{" "}
              <span className="font-semibold text-text-primary">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </span>
              . Choose what to do with them.
            </>
          ) : (
            <>
              This permanently deletes the section{" "}
              <span className="font-semibold text-text-primary">
                and all {itemCount} item{itemCount === 1 ? "" : "s"}
              </span>{" "}
              inside it. This cannot be undone.
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {!empty && phase === "choice" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm(false)}
            className="flex items-start gap-3 rounded-lg border border-border-default bg-bg-elevated/40 p-3 text-left hover:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors disabled:opacity-50"
          >
            <Inbox className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary">
                Move items to Unassigned
              </span>
              <span className="text-xs text-text-muted">
                Keeps the items. They reflow into the Unassigned bucket.
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => setPhase("cascade-confirm")}
            className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-3 text-left hover:bg-error/10 focus:outline-none focus:ring-2 focus:ring-error/30 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 text-error mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-error">
                Delete section and all {itemCount} item
                {itemCount === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-text-muted">
                Irreversible. Wipes both the section and its items.
              </span>
            </div>
          </button>
        </div>
      )}

      {phase === "cascade-confirm" && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Type{" "}
              <span className="font-mono font-bold text-text-primary">
                DELETE
              </span>{" "}
              to confirm
            </span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
              disabled={submitting}
            />
          </label>
        </div>
      )}

      <DialogFooter className="gap-2">
        {phase === "cascade-confirm" ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPhase("choice")}
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void onConfirm(true)}
              disabled={!cascadeUnlocked || submitting}
            >
              {submitting
                ? "Deleting..."
                : `Delete section + ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            </Button>
          </>
        ) : (
          <>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            {empty && (
              <Button
                type="button"
                variant="danger"
                onClick={() => void onConfirm(false)}
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete section"}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  );
}
