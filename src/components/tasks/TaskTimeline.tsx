"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Pencil,
  Trash2,
  MoreVertical,
  CircleDot,
  Flag,
  Tag,
  UserCircle2,
  CalendarClock,
  FolderClosed,
  Layers,
  FileEdit,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { toast } from "@/components/ui/useToast";
import { taskComments } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/auditConstants";
import { TaskMarkdownEditor } from "./TaskMarkdownEditor";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { formatDate, STATUS_LABEL, capitalize } from "@/lib/taskUtils";
import { timeAgo } from "@/lib/formatTime";
import type { Task, TaskActivityEntry, TaskStatus } from "@/types";

export type CommentEntry = Extract<TaskActivityEntry, { kind: "comment" }>;
type EventEntry = Extract<TaskActivityEntry, { kind: "event" }>;

interface TaskTimelineProps {
  task: Task;
  /** Merged comment + audit-event feed, ordered chronologically. */
  activity: TaskActivityEntry[];
  /** True while the activity SWR is in its first fetch — renders placeholders. */
  isLoadingActivity?: boolean;
  currentUserId: string | null;
  canEditTask: boolean;
  onUpdateTask: (patch: Record<string, unknown>) => Promise<void>;
  /** Called after a comment was edited / deleted so the page can refetch. */
  onActivityChanged: () => void;
}

/**
 * Vertical timeline rail with avatar bullets — original-post card on top,
 * each subsequent entry hangs off the rail beneath it. Two entry kinds:
 *
 * - **Comments** (`kind: "comment"`) — full markdown card; author can edit
 *   or delete via the `…` menu.
 * - **Events** (`kind: "event"`) — compact single-line activity row, e.g.
 *   "Zaid changed status from To Do to In Progress · 2h ago". Read-only.
 *
 * Description edit is gated on `canEditTask`. The rail's vertical line is
 * drawn by the parent page wrapper so it can span through the composer.
 */
export function TaskTimeline({
  task,
  activity,
  isLoadingActivity,
  currentUserId,
  canEditTask,
  onUpdateTask,
  onActivityChanged,
}: TaskTimelineProps) {
  return (
    <div className="space-y-4">
      <DescriptionCard
        task={task}
        canEdit={canEditTask}
        onSave={(description) => onUpdateTask({ description })}
      />

      {isLoadingActivity
        ? Array.from({ length: 2 }).map((_, i) => (
            <CommentCardSkeleton key={i} />
          ))
        : activity.map((entry) =>
            entry.kind === "comment" ? (
              <CommentCard
                key={entry.id}
                comment={entry}
                taskId={task.id}
                isAuthor={currentUserId === entry.author_id}
                onChanged={onActivityChanged}
              />
            ) : (
              <EventRow key={entry.id} event={entry} />
            )
          )}
    </div>
  );
}

// ─── Activity event row ────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ElementType> = {
  [AUDIT_ACTIONS.TASK_STATUS_CHANGED]: CircleDot,
  [AUDIT_ACTIONS.TASK_PRIORITY_CHANGED]: Flag,
  [AUDIT_ACTIONS.TASK_CATEGORY_CHANGED]: Tag,
  [AUDIT_ACTIONS.TASK_ASSIGNEE_CHANGED]: UserCircle2,
  [AUDIT_ACTIONS.TASK_DUE_DATE_CHANGED]: CalendarClock,
  [AUDIT_ACTIONS.TASK_PROJECT_CHANGED]: FolderClosed,
  [AUDIT_ACTIONS.TASK_PHASE_CHANGED]: Layers,
  [AUDIT_ACTIONS.TASK_TITLE_CHANGED]: Pencil,
  [AUDIT_ACTIONS.TASK_DESCRIPTION_CHANGED]: FileEdit,
};

/**
 * One-line activity row hanging off the rail. The icon doubles as the rail
 * bullet (matches the avatar circle from comments / description in size).
 */
function EventRow({ event }: { event: EventEntry }) {
  const Icon = EVENT_ICON[event.action] ?? CircleDot;
  const actor = event.actor_name ?? "Someone";
  return (
    <div className="relative pl-9 py-1">
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-bg-elevated ring-2 ring-bg-primary flex items-center justify-center text-text-muted">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-text-secondary leading-6">
        <span className="font-medium text-text-primary">{actor}</span>
        <EventDescription event={event} />
        <span className="text-xs text-text-muted">·</span>
        <time
          className="text-xs text-text-muted"
          dateTime={event.created_at}
          title={new Date(event.created_at).toLocaleString()}
        >
          {timeAgo(event.created_at)}
        </time>
      </div>
    </div>
  );
}

/** Renders the verb + values portion of an event entry, by action type. */
function EventDescription({ event }: { event: EventEntry }) {
  const m = event.metadata ?? {};
  const from = m.from as string | null | undefined;
  const to = m.to as string | null | undefined;
  const toName = (m.to_name as string | null | undefined) ?? null;

  switch (event.action) {
    case AUDIT_ACTIONS.TASK_STATUS_CHANGED:
      return (
        <>
          <span>changed status from</span>
          <ValuePill>
            {from ? (STATUS_LABEL[from as TaskStatus] ?? from) : "—"}
          </ValuePill>
          <span>to</span>
          <ValuePill>
            {to ? (STATUS_LABEL[to as TaskStatus] ?? to) : "—"}
          </ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_PRIORITY_CHANGED:
      return (
        <>
          <span>set priority to</span>
          <ValuePill>{capitalize(to ?? "—")}</ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_CATEGORY_CHANGED:
      return (
        <>
          <span>set category to</span>
          <ValuePill>{capitalize(to ?? "—")}</ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_ASSIGNEE_CHANGED:
      if (!toName && !to) return <span>unassigned this task</span>;
      return (
        <>
          <span>assigned this to</span>
          <ValuePill>{toName ?? to}</ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_DUE_DATE_CHANGED:
      if (!to) return <span>cleared the due date</span>;
      return (
        <>
          <span>set due date to</span>
          <ValuePill>{formatDate(to)}</ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_PROJECT_CHANGED:
      return (
        <>
          <span>moved this to</span>
          <ValuePill>{toName ?? to ?? "—"}</ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_PHASE_CHANGED:
      if (!to) return <span>cleared the phase</span>;
      return (
        <>
          <span>set phase to</span>
          <ValuePill>{toName ?? to}</ValuePill>
        </>
      );
    case AUDIT_ACTIONS.TASK_TITLE_CHANGED:
      return <span>edited the title</span>;
    case AUDIT_ACTIONS.TASK_DESCRIPTION_CHANGED:
      return <span>edited the description</span>;
    default:
      return <span>{event.action}</span>;
  }
}

function ValuePill({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="draft" className="font-normal">
      {children}
    </Badge>
  );
}

/** Placeholder rail bullet + card while comments are loading. */
export function CommentCardSkeleton() {
  return (
    <article className="relative pl-9">
      <Skeleton className="absolute left-0 top-2 w-6 h-6 rounded-full ring-2 ring-bg-primary" />
      <div className="rounded-lg border border-border-default bg-bg-secondary overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated/40 border-b border-border-default">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </header>
        <div className="px-4 py-3 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      </div>
    </article>
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
  comment: CommentEntry;
  taskId: string;
  isAuthor: boolean;
  onChanged: () => void;
}

/**
 * Single comment card with rail bullet, edit/delete dropdown for the
 * author, and inline markdown editor when editing. Exported so the side
 * panel can reuse it for a consistent comment renderer across surfaces.
 */
export function CommentCard({
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
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
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
