"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  CheckSquare,
  Pencil,
  Folder,
  Layers,
  Calendar as CalendarIcon,
  Flag,
  Tag,
  User,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Calendar } from "@/components/ui/calendar";
import { authClient } from "@/lib/authClient";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { tasks as tasksApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { TaskComposer } from "@/components/tasks/TaskComposer";
import { TaskTimeline } from "@/components/tasks/TaskTimeline";
import {
  FieldCard,
  PickerPanel,
  priorityClass,
} from "@/components/tasks/MetadataPickers";
import { avatarColor } from "@/lib/avatarUtils";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDate,
  PRIORITIES,
  CATEGORIES,
  capitalize,
} from "@/lib/taskUtils";
import { pinCommentReviewHref } from "@/lib/pinUtils";
import { deriveInitials } from "@/lib/utils";
import type { Task, TaskComment, OrgMember } from "@/types";

interface ProjectOption {
  id: string;
  name: string;
}
interface PhaseOption {
  id: string;
  name: string;
}

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

  const {
    data: task,
    error,
    mutate: mutateTask,
  } = useSWR<Task>(`/api/tasks/${id}`);
  const { data: commentsData, mutate: mutateComments } = useSWR<{
    comments: TaskComment[];
  }>(`/api/tasks/${id}/comments`);
  const comments = commentsData?.comments ?? [];

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
        mutateTask();
      } catch (err) {
        toast({
          title: "Couldn't update task",
          description:
            err instanceof Error ? err.message : "Try again in a moment.",
          variant: "error",
        });
      }
    },
    [task, mutateTask]
  );

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
          <Link
            href="/tasks"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Tasks
          </Link>
          {task.project_name && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                href={`/projects/${task.project_id}`}
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
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
            {comments.length} comment{comments.length === 1 ? "" : "s"}
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
        <div className="min-w-0">
          <div className="relative">
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border-default" />
            <TaskTimeline
              task={task}
              comments={comments}
              currentUserId={session?.user?.id ?? null}
              canEditTask={canEdit}
              onUpdateTask={onUpdate}
              onCommentsChanged={() => mutateComments()}
            />
            <div className="mt-4">
              <TaskComposer
                taskId={task.id}
                inTimeline
                onSubmitted={() => mutateComments()}
              />
            </div>
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
          className="flex-1 text-2xl font-bold leading-tight bg-bg-secondary border border-accent rounded-md px-3 py-2 text-text-primary focus:outline-none resize-none"
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

function TaskSidebarCard({
  task,
  canEdit,
  currentUserId,
  onUpdate,
}: TaskSidebarCardProps) {
  // Render-only fallback for clients/viewers — short-circuits the
  // members/projects/phases fetches that the picker version triggers.
  if (!canEdit) {
    return <ReadOnlySidebar task={task} />;
  }
  return (
    <EditableSidebarCard
      task={task}
      currentUserId={currentUserId}
      onUpdate={onUpdate}
    />
  );
}

interface EditableSidebarCardProps {
  task: Task;
  currentUserId: string | null;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}

function EditableSidebarCard({
  task,
  currentUserId,
  onUpdate,
}: EditableSidebarCardProps) {
  const { members } = useOrgMembers({ assignableOnly: false });
  const { data: projects = [] } = useSWR<ProjectOption[]>("/api/projects");

  const { data: projectDetail, isLoading: loadingPhases } = useSWR<{
    phases?: PhaseOption[];
  }>(task.project_id ? `/api/projects/${task.project_id}` : null);
  const phases = useMemo(
    () => projectDetail?.phases ?? [],
    [projectDetail?.phases]
  );

  const selectedAssignee = useMemo(
    () => members.find((m) => m.userId === task.assigned_to),
    [members, task.assigned_to]
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === task.project_id),
    [projects, task.project_id]
  );
  const selectedPhase = useMemo(
    () => phases.find((p) => p.id === task.phase_id),
    [phases, task.phase_id]
  );

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      {/* Assignees */}
      <FieldCard
        icon={User}
        label="Assignees"
        divider
        picker={() => (
          <PickerPanel
            title="Assign up to 1 person to this task"
            searchPlaceholder="Type or choose a user"
            searchKeys={(m: OrgMember) => [m.user.name, m.user.email]}
            options={members}
            getKey={(m) => m.userId}
            isSelected={(m) => m.userId === task.assigned_to}
            onSelect={(m) => {
              const next = m.userId === task.assigned_to ? null : m.userId;
              onUpdate({ assignedTo: next });
            }}
            renderOption={(m) => (
              <div className="flex items-center gap-2 min-w-0">
                <Avatar
                  initials={deriveInitials(m.user.name || m.user.email)}
                  color={avatarColor(m.userId)}
                  size="sm"
                />
                <span className="text-sm text-text-primary truncate">
                  {m.user.name || m.user.email}
                </span>
                {m.user.name && (
                  <span className="text-xs text-text-muted truncate">
                    {m.user.email}
                  </span>
                )}
              </div>
            )}
          />
        )}
      >
        {selectedAssignee ? (
          <div className="flex items-center gap-2">
            <Avatar
              initials={deriveInitials(
                selectedAssignee.user.name || selectedAssignee.user.email
              )}
              color={avatarColor(selectedAssignee.userId)}
              size="sm"
            />
            <span className="text-sm font-medium text-text-primary truncate">
              {selectedAssignee.user.name || selectedAssignee.user.email}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-sm text-text-muted">No one assigned</span>
            {currentUserId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ assignedTo: currentUserId });
                }}
                className="block text-xs text-accent hover:underline"
              >
                Assign yourself
              </button>
            )}
          </div>
        )}
      </FieldCard>

      {/* Project */}
      <FieldCard
        icon={Folder}
        label="Project"
        divider
        picker={(close) => (
          <PickerPanel
            title="Pick a project"
            searchPlaceholder="Filter projects"
            searchKeys={(p: ProjectOption) => [p.name]}
            options={projects}
            getKey={(p) => p.id}
            isSelected={(p) => p.id === task.project_id}
            onSelect={(p) => {
              const next = p.id === task.project_id ? null : p.id;
              onUpdate({ projectId: next, phaseId: null });
              close();
            }}
            renderOption={(p) => (
              <span className="text-sm text-text-primary">{p.name}</span>
            )}
            emptyHint="No projects in this org yet."
          />
        )}
      >
        {selectedProject ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
            <Folder className="w-3 h-3" />
            {selectedProject.name}
          </span>
        ) : (
          <span className="text-sm text-text-muted">No project</span>
        )}
      </FieldCard>

      {/* Phase */}
      <FieldCard
        icon={Layers}
        label="Phase"
        divider
        picker={(close) => (
          <PickerPanel
            title="Pick a phase"
            searchPlaceholder="Filter phases"
            searchKeys={(p: PhaseOption) => [p.name]}
            options={phases}
            getKey={(p) => p.id}
            isSelected={(p) => p.id === task.phase_id}
            onSelect={(p) => {
              const next = p.id === task.phase_id ? null : p.id;
              onUpdate({ phaseId: next });
              close();
            }}
            renderOption={(p) => (
              <span className="text-sm text-text-primary">{p.name}</span>
            )}
            emptyHint={
              !task.project_id
                ? "Select a project first to choose a phase."
                : loadingPhases
                  ? "Loading phases…"
                  : "This project has no phases."
            }
          />
        )}
      >
        <span className="text-sm text-text-primary">
          {selectedPhase
            ? selectedPhase.name
            : !task.project_id
              ? "—"
              : loadingPhases
                ? "Loading…"
                : "No phase"}
        </span>
      </FieldCard>

      {/* Due date */}
      <FieldCard
        icon={CalendarIcon}
        label="Due date"
        divider
        popoverWidth="w-auto"
        picker={(close) => (
          <div className="p-2">
            <Calendar
              mode="single"
              selected={
                task.due_date
                  ? new Date(task.due_date + "T00:00:00")
                  : undefined
              }
              onSelect={(date) => {
                onUpdate({
                  dueDate: date ? format(date, "yyyy-MM-dd") : null,
                });
                close();
              }}
              defaultMonth={
                task.due_date
                  ? new Date(task.due_date + "T00:00:00")
                  : undefined
              }
            />
            {task.due_date && (
              <button
                type="button"
                onClick={() => {
                  onUpdate({ dueDate: null });
                  close();
                }}
                className="mt-2 w-full text-xs text-text-muted hover:text-text-primary py-1.5 hover:bg-bg-elevated/60 rounded-md transition-colors cursor-pointer"
              >
                Clear date
              </button>
            )}
          </div>
        )}
      >
        {task.due_date ? (
          <span className="text-sm text-text-primary">
            {formatDate(task.due_date)}
          </span>
        ) : (
          <span className="text-sm text-text-muted">No due date</span>
        )}
      </FieldCard>

      {/* Priority */}
      <FieldCard
        icon={Flag}
        label="Priority"
        divider
        picker={(close) => (
          <PickerPanel
            title="Set priority"
            options={PRIORITIES as readonly string[]}
            getKey={(p) => p}
            isSelected={(p) => p === task.priority}
            onSelect={(p) => {
              onUpdate({ priority: p });
              close();
            }}
            renderOption={(p) => (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(p)}`}
              >
                <Flag className="w-3 h-3" />
                {capitalize(p)}
              </span>
            )}
          />
        )}
      >
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(task.priority)}`}
        >
          <Flag className="w-3 h-3" />
          {capitalize(task.priority)}
        </span>
      </FieldCard>

      {/* Category */}
      <FieldCard
        icon={Tag}
        label="Category"
        picker={(close) => (
          <PickerPanel
            title="Pick a category"
            options={CATEGORIES as readonly string[]}
            getKey={(c) => c}
            isSelected={(c) => c === task.category}
            onSelect={(c) => {
              onUpdate({ category: c });
              close();
            }}
            renderOption={(c) => (
              <span className="text-sm text-text-primary">{capitalize(c)}</span>
            )}
          />
        )}
      >
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
          <Tag className="w-3 h-3" />
          {capitalize(task.category)}
        </span>
      </FieldCard>
    </div>
  );
}

// Read-only sidebar variant used when the viewer can't edit.
function ReadOnlySidebar({ task }: { task: Task }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary divide-y divide-border-default">
      <ReadRow icon={User} label="Assignees">
        {task.assigned_to_name ? (
          <div className="flex items-center gap-2">
            <Avatar
              initials={deriveInitials(task.assigned_to_name)}
              color={avatarColor(task.assigned_to ?? task.assigned_to_name)}
              size="sm"
            />
            <span className="text-sm text-text-primary">
              {task.assigned_to_name}
            </span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">No one assigned</span>
        )}
      </ReadRow>
      <ReadRow icon={Folder} label="Project">
        {task.project_name ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
            <Folder className="w-3 h-3" />
            {task.project_name}
          </span>
        ) : (
          <span className="text-sm text-text-muted">No project</span>
        )}
      </ReadRow>
      <ReadRow icon={Layers} label="Phase">
        <span className="text-sm text-text-primary">
          {task.phase_name ?? "—"}
        </span>
      </ReadRow>
      <ReadRow icon={CalendarIcon} label="Due date">
        <span className="text-sm text-text-primary">
          {task.due_date ? formatDate(task.due_date) : "—"}
        </span>
      </ReadRow>
      <ReadRow icon={Flag} label="Priority">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(task.priority)}`}
        >
          <Flag className="w-3 h-3" />
          {capitalize(task.priority)}
        </span>
      </ReadRow>
      <ReadRow icon={Tag} label="Category">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
          <Tag className="w-3 h-3" />
          {capitalize(task.category)}
        </span>
      </ReadRow>
    </div>
  );
}

function ReadRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-[12px] font-semibold text-text-primary">
          {label}
        </span>
      </div>
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
