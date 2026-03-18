"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Pencil,
  X,
  ClipboardCheck,
} from "lucide-react";
import { displayName } from "@/lib/fileUtils";
import type { DbAttachmentReview } from "@/types";

interface ReviewPanelProps {
  reviews: DbAttachmentReview[];
  onClose: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Side panel showing review history for the current attachment.
 */
export function ReviewPanel({ reviews, onClose }: ReviewPanelProps) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 z-40 bg-[#0D0D0D] border-l border-[#222] flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-[#222]">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#666]" />
          <span className="text-[13px] font-medium text-white">Reviews</span>
          {reviews.length > 0 && (
            <span className="text-[11px] text-[#666] bg-[#1A1A1A] px-1.5 py-0.5 rounded-full">
              {reviews.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[#666] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Review list */}
      <div className="flex-1 overflow-y-auto">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <ClipboardCheck className="w-8 h-8 text-[#333] mb-3" />
            <p className="text-[12px] text-[#555] text-center">
              No reviews yet
            </p>
          </div>
        ) : (
          <div className="py-1">
            {reviews.map((rev, i) => {
              const isRejected = rev.status === "rejected";
              const isLatest = i === 0;
              return (
                <div
                  key={rev.id}
                  className={`px-3 py-3 border-b border-[#1A1A1A] ${
                    isLatest ? "bg-[#111]" : ""
                  }`}
                >
                  {/* Status + reviewer */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {isRejected ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span
                      className={`text-[12px] font-medium truncate ${
                        isLatest ? "text-white" : "text-[#A0A0A0]"
                      }`}
                    >
                      {displayName(rev.reviewer_name)}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] text-[#555] bg-[#1A1A1A] border border-[#333] px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Decision */}
                  <div className="flex items-center gap-2 ml-5.5 mb-1">
                    <span
                      className={`text-[11px] font-medium ${
                        isRejected ? "text-[#F59E0B]" : "text-emerald-400"
                      }`}
                    >
                      {isRejected ? "Changes Requested" : "Approved"}
                    </span>
                    {rev.annotation_count > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-[#F5C518]">
                        <Pencil className="w-2.5 h-2.5" />
                        {rev.annotation_count}
                      </span>
                    )}
                  </div>

                  {/* Comment */}
                  {rev.comment && (
                    <p className="text-[11px] text-[#888] ml-5.5 mb-1.5 leading-relaxed">
                      {rev.comment}
                    </p>
                  )}

                  {/* Annotated PDF link */}
                  {rev.annotated_file_url && (
                    <a
                      href={`/api/proxy-file?url=${encodeURIComponent(rev.annotated_file_url)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#F5C518] hover:text-[#F5C518]/80 ml-5.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Annotated PDF
                    </a>
                  )}

                  {/* Timestamp */}
                  <p className="text-[10px] text-[#555] ml-5.5 mt-1.5">
                    {formatDate(rev.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
