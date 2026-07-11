"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { formatDate } from "@/lib/formatDate";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { DbComment } from "@/types";

interface CommentsSectionProps {
  comments: DbComment[];
  /** Returns true on success (input is cleared), false on failure. */
  submitComment: (text: string) => Promise<boolean>;
}

/**
 * Project comments thread + input. Owns the input draft and sending
 * flag locally so keystrokes don't re-render the parent layout subtree.
 */
export function CommentsSection({
  comments,
  submitComment,
}: CommentsSectionProps) {
  const t = useTranslations("projectDetail");
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useStaggerReveal<HTMLDivElement>(
    comments.map((c) => c.id).join(",")
  );

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    const ok = await submitComment(newComment);
    setSending(false);
    if (ok) setNewComment("");
  };

  return (
    <div className="px-4 lg:px-10 pb-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {t("comments", { count: comments.length })}
        </h3>

        <div className="flex gap-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("commentPlaceholder")}
            className="flex-1 rounded-lg border border-border-default bg-bg-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            rows={2}
          />
          <Button
            size="sm"
            className="self-end"
            onClick={handleSend}
            disabled={!newComment.trim() || sending}
          >
            {sending ? (
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
          <div ref={listRef} className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                data-anim-item
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
