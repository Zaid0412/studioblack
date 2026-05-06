"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { formatFileSize } from "@/lib/fileUtils";
import { timeAgo } from "@/lib/formatTime";
import type { TaskComment } from "@/types";

interface TaskCommentListProps {
  comments: TaskComment[];
  /** True while the comments SWR is in its first fetch — renders placeholders. */
  isLoading?: boolean;
}

/** Renders the comment thread inside the task side panel and full page. */
export function TaskCommentList({ comments, isLoading }: TaskCommentListProps) {
  if (isLoading) {
    return (
      <ul className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <CommentCardSkeleton key={i} />
        ))}
      </ul>
    );
  }
  if (comments.length === 0) return null;
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} />
      ))}
    </ul>
  );
}

function CommentCardSkeleton() {
  return (
    <li className="rounded-lg border border-border-default bg-bg-primary overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated/50 border-b border-border-default">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </header>
      <div className="px-4 py-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </li>
  );
}

function CommentCard({ comment }: { comment: TaskComment }) {
  return (
    <li className="rounded-lg border border-border-default bg-bg-primary overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated/50 border-b border-border-default">
        <Avatar
          initials={deriveInitials(comment.author_name)}
          color={avatarColor(comment.author_id)}
          size="sm"
        />
        <span className="text-sm font-semibold text-text-primary">
          {comment.author_name}
        </span>
        <span className="text-xs text-text-muted">·</span>
        <span className="text-xs text-text-muted">
          {timeAgo(comment.created_at)}
        </span>
        {comment.updated_at && (
          <span className="text-xs italic text-text-muted ml-1">(edited)</span>
        )}
      </header>
      <div className="markdown-preview px-4 py-3 text-sm text-text-primary leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {comment.body}
        </ReactMarkdown>
        {comment.attachments.length > 0 && (
          <ul className="mt-3 space-y-1">
            {comment.attachments.map((att, i) => (
              <li key={`${att.url}-${i}`}>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-info hover:underline"
                >
                  {att.name}
                </a>
                {att.size != null && (
                  <span className="ml-2 text-xs text-text-muted">
                    {formatFileSize(att.size)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
