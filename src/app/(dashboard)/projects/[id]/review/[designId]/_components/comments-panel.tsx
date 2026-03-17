"use client";

import { useTranslations } from "next-intl";
import { X, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { deriveInitials } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format-time";
import type { DbComment } from "@/types";

interface CommentsPanelProps {
  comments: DbComment[];
  newComment: string;
  setNewComment: (value: string) => void;
  submittingComment: boolean;
  handlePostComment: () => void;
  onClose: () => void;
}

/**
 *
 */
export function CommentsPanel({
  comments,
  newComment,
  setNewComment,
  submittingComment,
  handlePostComment,
  onClose,
}: CommentsPanelProps) {
  const t = useTranslations("designReview");
  const tc = useTranslations("common");

  return (
    <div className="w-[360px] shrink-0 bg-[#1A1A1A] border-l border-[#333333] flex flex-col">
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-[#333333]">
        <span className="text-white text-base font-semibold">
          {t("comments")}
        </span>
        <button
          onClick={onClose}
          className="text-[#A0A0A0] hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Add Comment Form */}
      <div className="p-5 flex flex-col gap-3 border-b border-[#333333]">
        <label className="text-white text-[13px] font-semibold">
          {t("addComment")}
        </label>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t("commentPlaceholder")}
          className="w-full h-20 bg-[#2A2A2A] border border-[#333333] rounded-lg p-3 text-sm text-white placeholder:text-[#666666] resize-none focus:outline-none focus:border-[#F5C518]"
        />
        <button
          onClick={handlePostComment}
          disabled={submittingComment || !newComment.trim()}
          className="self-start bg-[#F5C518] text-[#0D0D0D] text-[13px] font-semibold rounded-lg py-2.5 px-6 hover:bg-[#F5C518]/90 transition-colors cursor-pointer disabled:opacity-50"
        >
          {submittingComment ? "Posting..." : t("sendComment")}
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-5">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MessageCircle className="w-12 h-12 text-[#333333]" />
            <p className="text-[#666666] text-sm">No Comments to show</p>
            <p className="text-[#666666] text-xs text-center">
              Be the first to leave feedback on this design.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex flex-col gap-2 rounded-xl bg-[#242424] p-4"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar
                    initials={deriveInitials(comment.user_name)}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-white">
                      {comment.user_name}
                    </span>
                    <span className="text-[11px] text-[#A0A0A0]">
                      {formatTimeAgo(comment.created_at, tc)}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-[#A0A0A0] leading-relaxed">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
