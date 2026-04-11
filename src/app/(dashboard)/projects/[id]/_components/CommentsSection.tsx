"use client";

import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import type { DbComment } from "@/types";

interface CommentsSectionProps {
  comments: DbComment[];
  newComment: string;
  onNewCommentChange: (value: string) => void;
  sendingComment: boolean;
  onSendComment: () => void;
}

/** Displays project comments thread with input for new comments. */
export function CommentsSection({
  comments,
  newComment,
  onNewCommentChange,
  sendingComment,
  onSendComment,
}: CommentsSectionProps) {
  return (
    <div className="px-4 lg:px-10 pb-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Comments ({comments.length})
        </h3>

        <div className="flex gap-3">
          <textarea
            value={newComment}
            onChange={(e) => onNewCommentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSendComment();
              }
            }}
            placeholder="Leave a comment... (Ctrl+Enter to send)"
            className="flex-1 rounded-lg border border-border-default bg-bg-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
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
            No comments yet.
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
                      {new Date(comment.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed">
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
