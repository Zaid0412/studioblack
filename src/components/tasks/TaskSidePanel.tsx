"use client";

import { useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, X, MessageSquare, Pencil } from "lucide-react";
import useSWR from "swr";
import { API } from "@/lib/api/routes";
import { authClient } from "@/lib/authClient";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { avatarColor } from "@/lib/avatarUtils";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDate,
} from "@/lib/taskUtils";
import { pinCommentReviewHref } from "@/lib/pinUtils";
import { deriveInitials } from "@/lib/utils";
import { TaskComposer } from "./TaskComposer";
import {
  CommentCard,
  CommentCardSkeleton,
  type CommentEntry,
} from "./TaskTimeline";
import type { Task, TaskActivityEntry } from "@/types";

interface TaskSidePanelProps {
  taskId: string;
  task: Task | null;
  /** True when the API returned an error (e.g. 404 — task missing or out of org). */
  missing: boolean;
  onClose: () => void;
}

/**
 * The universal task overlay panel — shown via `TaskSidePanelHost` whenever
 * `?task=<id>` is present in the URL. Renders task header + description +
 * comment thread + composer.
 *
 * Comments come from the merged `/activity` feed (filtered to `kind:
 * "comment"`) so the panel and the full `/tasks/[id]` page share the same
 * SWR cache key — posting a comment in either place updates both.
 */
export function TaskSidePanel({
  taskId,
  task,
  missing,
  onClose,
}: TaskSidePanelProps) {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;

  const { data: activityData, mutate: mutateActivity } = useSWR<{
    events: TaskActivityEntry[];
  }>(task ? API.taskActivity(taskId) : null);
  const comments = useMemo<CommentEntry[]>(
    () =>
      (activityData?.events ?? []).filter(
        (e): e is CommentEntry => e.kind === "comment"
      ),
    [activityData?.events]
  );
  const isLoadingActivity = !!task && activityData === undefined;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/55 transition-opacity duration-150"
      />

      <aside
        role="dialog"
        aria-label="Task details"
        className="fixed top-0 right-0 z-50 h-screen w-full max-w-[480px] bg-bg-secondary border-l border-border-default shadow-2xl flex flex-col"
      >
        {missing ? (
          <PanelMissing onClose={onClose} />
        ) : task ? (
          <PanelContent
            task={task}
            comments={comments}
            isLoadingComments={isLoadingActivity}
            currentUserId={currentUserId}
            onClose={onClose}
            onActivityChanged={() => mutateActivity()}
          />
        ) : (
          <PanelLoading onClose={onClose} />
        )}
      </aside>
    </>
  );
}

// ─── Sub-renderers ──────────────────────────────────────────────────────────

interface PanelContentProps {
  task: Task;
  comments: CommentEntry[];
  isLoadingComments: boolean;
  currentUserId: string | null;
  onClose: () => void;
  onActivityChanged: () => void;
}

function PanelContent({
  task,
  comments,
  isLoadingComments,
  currentUserId,
  onClose,
  onActivityChanged,
}: PanelContentProps) {
  return (
    <>
      <PanelHeader
        taskId={task.id}
        statusVariant={STATUS_BADGE_VARIANT[task.status] ?? "draft"}
        statusLabel={STATUS_LABEL[task.status] ?? task.status}
        onClose={onClose}
      />

      <div className="px-5 py-4 border-b border-border-default">
        <h2 className="text-lg font-semibold text-text-primary leading-snug">
          {task.title || "Untitled task"}
        </h2>
        {(task.project_name || task.phase_name) && (
          <p className="mt-1 text-xs text-text-muted">
            {task.project_id && task.project_name ? (
              <Link
                href={`/projects/${task.project_id}`}
                onClick={onClose}
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                {task.project_name}
              </Link>
            ) : (
              task.project_name
            )}
            {task.project_name && task.phase_name && <span> · </span>}
            {task.phase_name}
          </p>
        )}
        {(() => {
          const reviewHref = pinCommentReviewHref(task);
          if (!reviewHref) return null;
          return (
            <Link
              href={reviewHref}
              onClick={onClose}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-info hover:underline"
            >
              <MessageSquare className="w-3 h-3" />
              Linked from review comment
            </Link>
          );
        })()}
      </div>

      <MetaStrip task={task} />

      {/* Body — description + comments */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {task.description ? (
          <div className="markdown-preview rounded-lg border border-border-default bg-bg-primary p-4 text-sm text-text-primary leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {task.description}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm italic text-text-muted">
            No description provided.
          </p>
        )}
        {isLoadingComments ? (
          <ul className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <CommentCardSkeleton key={i} />
            ))}
          </ul>
        ) : comments.length > 0 ? (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id}>
                <CommentCard
                  comment={c}
                  taskId={task.id}
                  isAuthor={currentUserId === c.author_id}
                  onChanged={onActivityChanged}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <TaskComposer taskId={task.id} onSubmitted={onActivityChanged} />
    </>
  );
}

interface PanelHeaderProps {
  taskId: string;
  statusVariant: "draft" | "warning" | "success" | "archived";
  statusLabel: string;
  onClose: () => void;
}

function PanelHeader({
  taskId,
  statusVariant,
  statusLabel,
  onClose,
}: PanelHeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-border-default bg-bg-primary">
      <div className="flex items-center gap-2">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/tasks/${taskId}`}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          onClick={onClose}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Link>
        <Link
          href={`/tasks/${taskId}`}
          aria-label="Open full page"
          title="Open full page"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          onClick={onClose}
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function MetaStrip({ task }: { task: Task }) {
  const rows: { label: string; value: React.ReactNode }[] = [];

  if (task.assigned_to_name) {
    rows.push({
      label: "Assignee",
      value: (
        <span className="inline-flex items-center gap-2">
          <Avatar
            initials={deriveInitials(task.assigned_to_name)}
            color={avatarColor(task.assigned_to ?? task.assigned_to_name)}
            size="sm"
          />
          <span className="text-sm">{task.assigned_to_name}</span>
        </span>
      ),
    });
  }
  if (task.due_date) {
    rows.push({ label: "Due", value: formatDate(task.due_date) });
  }
  if (task.priority) {
    rows.push({
      label: "Priority",
      value: (
        <span className="text-sm capitalize text-text-primary">
          {task.priority}
        </span>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="px-5 py-3 border-b border-border-default space-y-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center gap-3 text-xs text-text-muted"
        >
          <span className="w-20 shrink-0">{r.label}</span>
          <span className="text-text-primary">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function PanelLoading({ onClose }: { onClose: () => void }) {
  return (
    <>
      <header className="flex items-center justify-between px-5 py-3 border-b border-border-default">
        <Skeleton className="h-6 w-24" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
        >
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 px-5 py-4 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    </>
  );
}

function PanelMissing({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-end px-5 py-3 border-b border-border-default">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
        >
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-2">
        <p className="text-base font-semibold text-text-primary">
          Task not found
        </p>
        <p className="text-sm text-text-muted">
          It may have been deleted or you don&apos;t have access to it.
        </p>
      </div>
    </div>
  );
}
