"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckSquare } from "lucide-react";
import { TaskCommentList } from "@/components/tasks/TaskCommentList";
import { TaskComposer } from "@/components/tasks/TaskComposer";
import { avatarColor } from "@/lib/avatarUtils";
import { STATUS_BADGE_VARIANT, formatDate } from "@/lib/taskUtils";
import { deriveInitials } from "@/lib/utils";
import type { Task, TaskComment } from "@/types";

/**
 * Full GitHub-issue-style page for a task. Same data as the side panel, but
 * spread across two columns (main thread + right sidebar with metadata)
 * with more breathing room for the comment thread.
 *
 * Reachable via the "Open page" link in `TaskSidePanel` or by deep-link.
 */
export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: task, error } = useSWR<Task>(`/api/tasks/${id}`);
  const { data: commentsData, mutate: mutateComments } = useSWR<{
    comments: TaskComment[];
  }>(`/api/tasks/${id}/comments`);
  const comments = commentsData?.comments ?? [];

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
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb + heading */}
      <header className="border-b border-border-default pb-5 mb-5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-text-muted mb-3"
        >
          <Link href="/tasks" className="hover:text-text-primary">
            Tasks
          </Link>
          {task.project_name && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                href={`/projects/${task.project_id}`}
                className="hover:text-text-primary"
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
        <h1 className="text-2xl font-bold text-text-primary leading-tight">
          {task.title || "Untitled task"}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
          <Badge variant={statusVariant}>{prettyStatus(task.status)}</Badge>
          <span>·</span>
          <span>opened by {task.created_by_name}</span>
          <span>·</span>
          <span>{formatDate(task.created_at)}</span>
          <span>·</span>
          <span>
            {comments.length} comment{comments.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {/* Body grid: main thread + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {task.description ? (
            <article className="rounded-lg border border-border-default bg-bg-secondary overflow-hidden">
              <header className="flex items-center gap-2 px-4 py-3 bg-bg-elevated/40 border-b border-border-default">
                <Avatar
                  initials={deriveInitials(task.created_by_name)}
                  color={avatarColor(task.created_by)}
                  size="sm"
                />
                <span className="text-sm font-semibold text-text-primary">
                  {task.created_by_name}
                </span>
                <span className="text-xs text-text-muted">·</span>
                <span className="text-xs text-text-muted">
                  {formatDate(task.created_at)}
                </span>
              </header>
              <div className="px-5 py-4">
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              </div>
            </article>
          ) : (
            <p className="text-sm italic text-text-muted">
              No description provided.
            </p>
          )}

          <TaskCommentList comments={comments} />

          <TaskComposer taskId={task.id} onSubmitted={() => mutateComments()} />
        </div>

        <aside className="space-y-4">
          <SidebarSection label="Assignee">
            {task.assigned_to_name ? (
              <div className="flex items-center gap-2">
                <Avatar
                  initials={deriveInitials(task.assigned_to_name)}
                  color={avatarColor(task.assigned_to ?? task.assigned_to_name)}
                  size="sm"
                />
                <span className="text-sm">{task.assigned_to_name}</span>
              </div>
            ) : (
              <span className="text-sm text-text-muted">Unassigned</span>
            )}
          </SidebarSection>

          <SidebarSection label="Priority">
            <span className="text-sm capitalize">{task.priority}</span>
          </SidebarSection>

          {task.due_date && (
            <SidebarSection label="Due">
              <span className="text-sm">{formatDate(task.due_date)}</span>
            </SidebarSection>
          )}

          {task.category && (
            <SidebarSection label="Category">
              <span className="text-sm capitalize">{task.category}</span>
            </SidebarSection>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface SidebarSectionProps {
  label: string;
  children: React.ReactNode;
}

function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-4 py-3">
      <h3 className="text-[10px] font-semibold tracking-widest text-text-muted uppercase mb-2">
        {label}
      </h3>
      {children}
    </div>
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

function prettyStatus(status: Task["status"]): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "todo":
      return "To Do";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}
