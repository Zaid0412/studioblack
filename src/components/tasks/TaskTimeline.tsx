"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Trash2, MoreVertical } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { toast } from "@/components/ui/useToast";
import { taskComments } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { TaskMarkdownEditor } from "./TaskMarkdownEditor";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { formatDate } from "@/lib/taskUtils";
import { timeAgo } from "@/lib/formatTime";
import type { Task, TaskComment } from "@/types";

interface TaskTimelineProps {
  task: Task;
  comments: TaskComment[];
  currentUserId: string | null;
  canEditTask: boolean;
  onUpdateTask: (patch: Record<string, unknown>) => Promise<void>;
  onCommentsChanged: () => void;
}

/**
 * Vertical timeline rail with avatar bullets — original-post card on top,
 * each comment hangs off the rail beneath it. Comment authors get an
 * `…` menu with Edit / Delete; the description block has its own edit
 * affordance gated on `canEditTask`.
 *
 * Future Phase 4: interleave audit_event entries (status changes,
 * assignee changes, etc.) chronologically with comments — the rail
 * already has the visual structure for compact activity rows.
 */
export function TaskTimeline({
  task,
  comments,
  currentUserId,
  canEditTask,
  onUpdateTask,
  onCommentsChanged,
}: TaskTimelineProps) {
  // The timeline rail is drawn by the parent page wrapper so it spans
  // through the composer too. Just lay out cards on top of it.
  return (
    <div className="space-y-4">
      <DescriptionCard
        task={task}
        canEdit={canEditTask}
        onSave={(description) => onUpdateTask({ description })}
      />

      {comments.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          taskId={task.id}
          isAuthor={currentUserId === comment.author_id}
          onChanged={onCommentsChanged}
        />
      ))}
    </div>
  );
}

// ─── Description (the "original post") ─────────────────────────────────────

interface DescriptionCardProps {
  task: Task;
  canEdit: boolean;
  onSave: (description: string) => Promise<void>;
}

function DescriptionCard({ task, canEdit, onSave }: DescriptionCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(task.description ?? "");
    setEditing(true);
  };

  const commit = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <article className="relative pl-9">
      {/* Avatar bullet on the rail */}
      <Avatar
        initials={deriveInitials(task.created_by_name)}
        color={avatarColor(task.created_by)}
        size="sm"
        className="absolute left-0 top-2 ring-2 ring-bg-primary"
      />

      <div className="rounded-lg border border-border-default bg-bg-secondary overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-3 bg-bg-elevated/40 border-b border-border-default">
          <span className="text-sm font-semibold text-text-primary">
            {task.created_by_name}
          </span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">
            opened this task on {formatDate(task.created_at)}
          </span>
          <span className="flex-1" />
          {canEdit && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors cursor-pointer"
              aria-label="Edit description"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </header>

        {editing ? (
          <div className="p-3 space-y-2">
            <TaskMarkdownEditor
              value={draft}
              onChange={setDraft}
              minHeight={200}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <Button size="sm" onClick={commit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : task.description ? (
          <div className="markdown-preview px-5 py-4 text-sm text-text-primary leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {task.description}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="px-5 py-4 text-sm italic text-text-muted">
            No description provided.
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Comment card ──────────────────────────────────────────────────────────

interface CommentCardProps {
  comment: TaskComment;
  taskId: string;
  isAuthor: boolean;
  onChanged: () => void;
}

function CommentCard({
  comment,
  taskId,
  isAuthor,
  onChanged,
}: CommentCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = () => {
    setDraft(comment.body);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === comment.body) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await taskComments.update(taskId, comment.id, { body: next });
      onChanged();
      setEditing(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Couldn't save comment";
      toast({
        title: "Edit failed",
        description: message,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await taskComments.remove(taskId, comment.id);
      onChanged();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Couldn't delete comment";
      toast({
        title: "Delete failed",
        description: message,
        variant: "error",
      });
      setDeleting(false);
    }
  };

  return (
    <article className="relative pl-9">
      <Avatar
        initials={deriveInitials(comment.author_name)}
        color={avatarColor(comment.author_id)}
        size="sm"
        className="absolute left-0 top-2 ring-2 ring-bg-primary"
      />

      <div className="rounded-lg border border-border-default bg-bg-secondary overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated/40 border-b border-border-default">
          <span className="text-sm font-semibold text-text-primary">
            {comment.author_name}
          </span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">
            commented {timeAgo(comment.created_at)}
          </span>
          {comment.updated_at && (
            <span className="text-xs italic text-text-muted">(edited)</span>
          )}
          <span className="flex-1" />
          {isAuthor && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 transition-colors cursor-pointer"
                  aria-label="Comment actions"
                  disabled={deleting}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startEdit}>
                  <Pencil className="w-4 h-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {editing ? (
          <div className="p-3 space-y-2">
            <TaskMarkdownEditor
              value={draft}
              onChange={setDraft}
              minHeight={120}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <Button size="sm" onClick={commit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="markdown-preview px-4 py-3 text-sm text-text-primary leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {comment.body}
            </ReactMarkdown>
            {comment.attachments.length > 0 && (
              <ul className="mt-3 space-y-1 not-prose">
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete comment?"
        description="This can't be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
        onConfirm={remove}
      />
    </article>
  );
}
