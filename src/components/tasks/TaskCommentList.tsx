"use client";

import { Avatar } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
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
          {formatRelativeTime(comment.created_at)}
        </span>
        {comment.updated_at && (
          <span className="text-xs italic text-text-muted ml-1">(edited)</span>
        )}
      </header>
      <div className="px-4 py-3">
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
          {comment.body}
        </p>
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

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
