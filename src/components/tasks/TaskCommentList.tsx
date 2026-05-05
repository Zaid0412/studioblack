"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { timeAgo } from "@/lib/formatTime";
import type { TaskComment } from "@/types";

interface TaskCommentListProps {
  comments: TaskComment[];
}

/** Renders the comment thread inside the task side panel and full page. */
export function TaskCommentList({ comments }: TaskCommentListProps) {
  if (comments.length === 0) return null;
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} />
      ))}
    </ul>
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
                    {formatBytes(att.size)}
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
