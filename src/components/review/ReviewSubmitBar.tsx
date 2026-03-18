"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Pencil,
} from "lucide-react";

interface ReviewSubmitBarProps {
  annotationCount: number;
  hasChanges: boolean;
  onSubmit: (status: "approved" | "rejected", comment: string) => Promise<void>;
}

/** Bottom bar for submitting a design review with approve/reject actions and comment. */
export function ReviewSubmitBar({
  annotationCount,
  hasChanges,
  onSubmit,
}: ReviewSubmitBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(
    null
  );

  async function handleSubmit(status: "approved" | "rejected") {
    setSubmitting(status);
    try {
      await onSubmit(status, comment);
      setComment("");
      setExpanded(false);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl shadow-2xl overflow-hidden">
        {/* Collapsed bar — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#222222] transition-colors"
        >
          <div className="flex items-center gap-3">
            {hasChanges ? (
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#F5C518]" />
                <span className="text-[13px] font-medium text-white">
                  {annotationCount} annotation
                  {annotationCount !== 1 ? "s" : ""}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#666666]" />
                <span className="text-[13px] text-[#A0A0A0]">
                  Submit your review
                </span>
              </div>
            )}
          </div>
          <span className="text-[11px] text-[#666666]">
            {expanded ? "Collapse" : "Expand"}
          </span>
        </button>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-[#333333] p-4">
            {/* Summary comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                hasChanges
                  ? "Add an overall summary of your feedback (optional)..."
                  : "Leave a comment about this design (optional)..."
              }
              className="w-full rounded-lg border border-[#333333] bg-[#0D0D0D] px-3 py-2.5 text-sm text-white placeholder:text-[#555555] resize-none focus:outline-none focus:border-[#F5C518] mb-3"
              rows={3}
            />

            {/* Submit buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleSubmit("approved")}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-2 border border-[#22C55E] text-[#22C55E] rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting === "approved" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {hasChanges ? "Approve with Notes" : "Approve"}
              </button>
              <button
                onClick={() => handleSubmit("rejected")}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-2 border border-[#F59E0B] text-[#F59E0B] rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting === "rejected" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                Request Changes
              </button>
            </div>

            {hasChanges && (
              <p className="text-[11px] text-[#555555] mt-2 text-center">
                Your {annotationCount} annotation
                {annotationCount !== 1 ? "s" : ""} will be saved with the
                review.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
