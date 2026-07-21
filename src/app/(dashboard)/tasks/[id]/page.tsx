"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, CheckSquare, Pencil, MessageSquare } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { authClient } from "@/lib/authClient";
import { useUserRole } from "@/hooks/useUserRole";
import { useLoadStagger } from "@/hooks/useLoadStagger";
import { tasks as tasksApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import { TaskComposer } from "@/components/tasks/TaskComposer";
import { TaskTimeline } from "@/components/tasks/TaskTimeline";
import {
  TaskMetadataSidebar,
  type TaskMetadataValues,
} from "@/components/tasks/TaskMetadataSidebar";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDate,
} from "@/lib/taskUtils";
import { pinCommentReviewHref } from "@/lib/pinUtils";
import type { Task, TaskActivityEntry } from "@/types";

/**
 * Full GitHub-issue-style page for a task — read + inline editing of title,
 * description, and the right-column metadata. Comment thread renders as a
 * timeline rail with avatar bullets.
 */
export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = authClient.useSession();
  const { role } = useUserRole();

  const { data: task, error, mutate: mutateTask } = useSWR<Task>(API.task(id));
  const revealRef = useLoadStagger<HTMLDivElement>(task ? task.id : "0", 90);
  const { data: activityData, mutate: mutateActivity } = useSWR<{
    events: TaskActivityEntry[];
  }>(API.taskActivity(id));
  const activity = useMemo(
    () => activityData?.events ?? [],
    [activityData?.events]
  );
  const commentCount = useMemo(
    () => activity.reduce((n, e) => (e.kind === "comment" ? n + 1 : n), 0),
    [activity]
  );
  const isLoadingActivity = activityData === undefined;

  const isCreator = !!task && session?.user?.id === task.created_by;
  const isPm = role === "pm" || role === "architect";
  const canEdit = isCreator || isPm;

  // ─── Update task patch ──────────────────────────────────────────────────

  // PATCH the task and revalidate. Skips an optimistic merge — the API
  // sends camelCase params (assignedTo, dueDate) but the cached `Task` is
  // snake_case (assigned_to, due_date), so a naive `{...task, ...patch}`
  // would diverge from the server shape. The revalidation latency is small
  // enough that the brief flicker is acceptable; pass `mutateTask(updated)`
  // with a key map if a follow-up wants true optimism.
  const onUpdate = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!task) return;
      try {
        await tasksApi.update(task.id, patch);
        // Refresh the task itself (sidebar values, header) and the activity
        // feed (new audit event for the change should appear in the rail).
        mutateTask();
        mutateActivity();
      } catch (err) {
        toast({
          title: "Couldn't update task",
          description:
            err instanceof Error ? err.message : "Try again in a moment.",
          variant: "error",
        });
      }
    },
    [task, mutateTask, mutateActivity]
  );

  const refreshActivity = useCallback(() => {
    void mutateActivity();
  }, [mutateActivity]);

  if (error) {
    return (
      <div className="max-w-4xl">
        <EmptyState
          icon={CheckSquare}
          title="Task not found"
          description="It may have been deleted or you don't have access to it."
          action={{
            label: "Back to tasks",
            onClick: () => {
              window.location.href = "/tasks";
            },
          }}
        />
      </div>
    );
  }

  if (!task) return <PageSkeleton />;

  const statusVariant = STATUS_BADGE_VARIANT[task.status] ?? "draft";

  return (
    <div ref={revealRef} className="stagger-children max-w-5xl mx-auto">
      {/* Breadcrumb + heading */}
      <header className="border-b border-border-default pb-5 mb-5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-text-muted mb-3"
        >
          <Link
            href="/tasks"
            className="text-accent-strong underline underline-offset-2 hover:text-accent-hover"
          >
            Tasks
          </Link>
          {task.project_name && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                href={`/projects/${task.project_id}`}
                className="text-accent-strong underline underline-offset-2 hover:text-accent-hover"
              >
                {task.project_name}
              </Link>
            </>
          )}
          {task.phase_name && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span>{task.phase_name}</span>
            </>
          )}
        </nav>

        <TitleField
          title={task.title}
          canEdit={canEdit}
          onSave={(t) => onUpdate({ title: t })}
        />

        <div className="mt-2 flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-text-muted">
          <Badge variant={statusVariant}>
            {STATUS_LABEL[task.status] ?? task.status}
          </Badge>
          <span>·</span>
          <span>opened by {task.created_by_name}</span>
          <span>·</span>
          <span>{formatDate(task.created_at)}</span>
          <span>·</span>
          <span>
            {commentCount} comment{commentCount === 1 ? "" : "s"}
          </span>
          {(() => {
            const reviewHref = pinCommentReviewHref(task);
            if (!reviewHref) return null;
            return (
              <>
                <span>·</span>
                <Link
                  href={reviewHref}
                  className="inline-flex items-center gap-1 text-info hover:underline"
                >
                  <MessageSquare className="w-3 h-3" />
                  Linked from review comment
                </Link>
              </>
            );
          })()}
        </div>
      </header>

      {/* Body grid: main thread + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-w-0">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border-default" />
          <TaskTimeline
            task={task}
            activity={activity}
            isLoadingActivity={isLoadingActivity}
            currentUserId={session?.user?.id ?? null}
            canEditTask={canEdit}
            onUpdateTask={onUpdate}
            onActivityChanged={refreshActivity}
          />
          <div className="mt-4">
            <TaskComposer
              taskId={task.id}
              inTimeline
              onSubmitted={refreshActivity}
            />
          </div>
        </div>

        <aside>
          <TaskSidebarCard
            task={task}
            canEdit={canEdit}
            currentUserId={session?.user?.id ?? null}
            onUpdate={onUpdate}
          />
        </aside>
      </div>
    </div>
  );
}

// ─── Title ──────────────────────────────────────────────────────────────────

interface TitleFieldProps {
  title: string;
  canEdit: boolean;
  onSave: (title: string) => Promise<void>;
}

function TitleField({ title, canEdit, onSave }: TitleFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(next);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          rows={2}
          autoFocus
          className="flex-1 text-2xl font-bold leading-tight bg-bg-secondary border border-accent-strong rounded-md px-3 py-2 text-text-primary focus:outline-none resize-none"
        />
        <div className="flex flex-col gap-1.5 pt-1">
          <Button size="sm" onClick={commit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <h1 className="text-2xl font-bold text-text-primary leading-tight flex-1 min-w-0 break-words">
        {title || "Untitled task"}
      </h1>
      {canEdit && (
        <button
          type="button"
          onClick={startEdit}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors cursor-pointer shrink-0"
          aria-label="Edit title"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      )}
    </div>
  );
}

// ─── Sidebar card ───────────────────────────────────────────────────────────

interface TaskSidebarCardProps {
  task: Task;
  canEdit: boolean;
  currentUserId: string | null;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}

/**
 * Sidebar wrapper that maps a `Task` row to the unified
 * `TaskMetadataSidebar`. Read-only viewers get the short-circuit
 * variant (no member / project / phase fetches) by passing
 * `readOnlyLabels` derived from the joined task row.
 */
function TaskSidebarCard({
  task,
  canEdit,
  currentUserId,
  onUpdate,
}: TaskSidebarCardProps) {
  const values: TaskMetadataValues = {
    assignedTo: task.assigned_to ?? null,
    projectId: task.project_id ?? null,
    phaseId: task.phase_id ?? null,
    dueDate: task.due_date ?? null,
    priority: task.priority,
    category: task.category,
  };
  if (!canEdit) {
    return (
      <TaskMetadataSidebar
        values={values}
        onChange={() => {}}
        currentUserId={currentUserId}
        readOnlyLabels={{
          assignedToName: task.assigned_to_name ?? null,
          projectName: task.project_name ?? null,
          phaseName: task.phase_name ?? null,
        }}
      />
    );
  }
  return (
    <TaskMetadataSidebar
      values={values}
      onChange={onUpdate}
      currentUserId={currentUserId}
    />
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="border-b border-border-default pb-5 mb-5 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
