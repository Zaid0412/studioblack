"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import type { DbAttachmentReview } from "@/types";

interface ReviewBannerProps {
  reviews: DbAttachmentReview[];
}

/**
 *
 */
export function ReviewBanner({ reviews }: ReviewBannerProps) {
  const [showHistory, setShowHistory] = useState(false);

  if (reviews.length === 0) return null;

  const latest = reviews[0];
  const older = reviews.slice(1);
  const isRejected = latest.status === "rejected";

  return (
    <div
      className={`shrink-0 border-b ${
        isRejected
          ? "bg-[#1A1600] border-[#333333]"
          : "bg-emerald-500/5 border-[#333333]"
      }`}
    >
      {/* Latest review */}
      <div className="px-4 py-2.5 flex items-start gap-3">
        {isRejected ? (
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-white">
              {latest.reviewer_name}
            </span>
            <span className="text-[13px] text-[#A0A0A0]">
              {isRejected ? "requested changes" : "approved"}
            </span>
            {latest.annotation_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-[#F5C518]">
                <Pencil className="w-3 h-3" />
                {latest.annotation_count} annotation
                {latest.annotation_count !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[11px] text-[#666666] ml-auto shrink-0">
              {new Date(latest.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {latest.comment && (
            <p className="text-[12px] text-[#A0A0A0] mt-1">{latest.comment}</p>
          )}
          {latest.annotated_file_url && (
            <a
              href={`/api/proxy-file?url=${encodeURIComponent(latest.annotated_file_url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#F5C518] hover:text-[#F5C518]/80 mt-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              View annotated PDF
            </a>
          )}
        </div>
      </div>

      {/* History toggle */}
      {older.length > 0 && (
        <>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-[#666666] hover:text-[#A0A0A0] transition-colors border-t border-[#333333]/50 cursor-pointer"
          >
            {showHistory ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Hide {older.length} older review
                {older.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show {older.length} older review
                {older.length !== 1 ? "s" : ""}
              </>
            )}
          </button>

          {showHistory && (
            <div className="border-t border-[#333333]/50">
              {older.map((rev) => (
                <div
                  key={rev.id}
                  className="px-4 py-2 flex items-start gap-3 border-b border-[#333333]/30 last:border-b-0"
                >
                  {rev.status === "rejected" ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#A0A0A0]">
                        {rev.reviewer_name}
                      </span>
                      <span className="text-[12px] text-[#666666]">
                        {rev.status === "rejected"
                          ? "requested changes"
                          : "approved"}
                      </span>
                      <span className="text-[10px] text-[#555555] ml-auto">
                        {new Date(rev.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    {rev.comment && (
                      <p className="text-[11px] text-[#666666] mt-0.5">
                        {rev.comment}
                      </p>
                    )}
                    {rev.annotated_file_url && (
                      <a
                        href={`/api/proxy-file?url=${encodeURIComponent(rev.annotated_file_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#F5C518] hover:text-[#F5C518]/80 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View annotated PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
