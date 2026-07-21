"use client";

import { History, X, FileClock } from "lucide-react";
import { displayName } from "@/lib/fileUtils";
import { formatShortDateTime } from "@/lib/formatDate";
import { ISSUE_PURPOSE_LABELS } from "@/lib/validations";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { DbDrawingRevision } from "@/types";

interface RevisionPanelProps {
  revisions: DbDrawingRevision[];
  onClose: () => void;
}

/** Two-digit revision tag, e.g. `Rev 02`. */
export function revLabel(revNumber: number): string {
  return `Rev ${String(revNumber).padStart(2, "0")}`;
}

/**
 * Side panel showing the issued-revision history for the current drawing
 * (Design → Document Control). Newest first; the top entry is the current one.
 */
export function RevisionPanel({ revisions, onClose }: RevisionPanelProps) {
  const listRef = useStaggerReveal<HTMLDivElement>(
    revisions.map((r) => r.id).join(",")
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-border-default">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-text-muted" />
          <span className="text-[13px] font-medium text-text-primary">
            Revisions
          </span>
          {revisions.length > 0 && (
            <span className="text-[11px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded-full">
              {revisions.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Close revision history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Revision list */}
      <div className="flex-1 overflow-y-auto">
        {revisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <FileClock className="w-8 h-8 text-text-secondary mb-3" />
            <p className="text-[12px] text-text-secondary text-center">
              No revisions issued yet
            </p>
          </div>
        ) : (
          <div ref={listRef} className="py-1">
            {revisions.map((rev, i) => {
              const isLatest = i === 0;
              return (
                <div
                  key={rev.id}
                  data-anim-item
                  className={`flex items-center gap-3 px-3 py-3 border-b border-border-default ${
                    isLatest ? "bg-bg-secondary" : ""
                  }`}
                >
                  {/* Rev tag */}
                  <span
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                      isLatest
                        ? "bg-accent/15 text-accent-strong"
                        : "bg-bg-elevated text-text-secondary"
                    }`}
                  >
                    R{String(rev.rev_number).padStart(2, "0")}
                  </span>

                  {/* Purpose + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-text-primary truncate">
                        {ISSUE_PURPOSE_LABELS[rev.issue_purpose]}
                      </span>
                      {isLatest && (
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {displayName(rev.issuer_name)} ·{" "}
                      {formatShortDateTime(rev.issued_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
