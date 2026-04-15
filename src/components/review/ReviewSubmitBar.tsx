"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";

interface ReviewSubmitBarProps {
  onSubmit: (status: "approved" | "rejected", comment: string) => Promise<void>;
  /** Called when client clicks "Request Changes" — triggers pin mode on the review page. */
  onRequestChanges?: () => void;
}

/** Bottom bar for submitting a design review with approve/reject actions and comment. */
export function ReviewSubmitBar({
  onSubmit,
  onRequestChanges,
}: ReviewSubmitBarProps) {
  const [selectedAction, setSelectedAction] = useState<
    "approved" | "rejected" | null
  >(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);

  // Reset requestingChanges when the user returns to the button view
  useEffect(() => {
    if (!selectedAction) setRequestingChanges(false);
  }, [selectedAction]);

  function handleActionClick(action: "approved" | "rejected") {
    setSelectedAction(action);
  }

  function handleCancel() {
    setSelectedAction(null);
    setComment("");
  }

  async function handleConfirm() {
    if (!selectedAction || !comment.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedAction, comment.trim());
      setComment("");
      setSelectedAction(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
      <div className="bg-bg-secondary border border-border-default rounded-xl shadow-2xl overflow-hidden">
        {/* Action buttons — visible when no action selected */}
        {!selectedAction && (
          <div className="flex items-center gap-2 p-3">
            <button
              onClick={() => handleActionClick("approved")}
              className="flex-1 flex items-center justify-center gap-2 border border-green-600 text-green-600 rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-green-600/10 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => {
                if (requestingChanges) return;
                setRequestingChanges(true);
                onRequestChanges?.();
              }}
              disabled={requestingChanges}
              className="flex-1 flex items-center justify-center gap-2 border border-amber-500 text-amber-500 rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-amber-500/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle className="w-4 h-4" />
              Request Changes
            </button>
          </div>
        )}

        {/* Comment panel — visible after clicking Approve */}
        {selectedAction === "approved" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-[13px] font-medium text-text-primary">
                  Approve design
                </span>
              </div>
              <button
                onClick={handleCancel}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment about your approval..."
              className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent mb-3"
              rows={3}
              autoFocus
            />

            <button
              onClick={handleConfirm}
              disabled={submitting || !comment.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirm Approval
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
