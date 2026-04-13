"use client";

import { Loader2, MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { formatDate } from "@/lib/formatDate";
import { MentionRenderer } from "@/components/ui/MentionRenderer";
import { MentionTextarea } from "@/components/ui/MentionTextarea";
import type { DbComment, MentionMember } from "@/types";

interface CommentsSectionProps {
  comments: DbComment[];
  newComment: string;
  onNewCommentChange: (value: string) => void;
  sendingComment: boolean;
  onSendComment: () => void;
  members?: MentionMember[];
}

/** Displays project comments thread with input for new comments. */
export function CommentsSection({
  comments,
  newComment,
  onNewCommentChange,
  sendingComment,
  onSendComment,
  members,
}: CommentsSectionProps) {
  const t = useTranslations("projectDetail");
  return (
    <div className="px-4 lg:px-10 pb-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {t("comments", { count: comments.length })}
        </h3>

        <div className="flex gap-3">
          <MentionTextarea
            value={newComment}
            onChange={onNewCommentChange}
            members={members ?? []}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSendComment();
              }
            }}
            placeholder={t("commentPlaceholder")}
            className="relative flex-1 rounded-lg border border-border-default bg-bg-secondary text-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30"
            rows={2}
          />
          <Button
            size="sm"
            className="self-end"
            onClick={onSendComment}
            disabled={!newComment.trim() || sendingComment}
          >
            {sendingComment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            {t("noCommentsYet")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-4"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar
                    initials={deriveInitials(comment.user_name)}
                    size="sm"
                    color={avatarColor(comment.user_id)}
                  />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-text-primary">
                      {comment.user_name}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <MentionRenderer content={comment.content} />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
