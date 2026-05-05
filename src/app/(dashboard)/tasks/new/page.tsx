"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  Loader2,
  Folder,
  Layers,
  Calendar as CalendarIcon,
  Flag,
  Tag,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { authClient } from "@/lib/authClient";
import { tasks as tasksApi, projects as projectsApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { PRIORITIES, CATEGORIES, capitalize } from "@/lib/taskUtils";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { TaskMarkdownEditor } from "@/components/tasks/TaskMarkdownEditor";
import {
  FieldCard,
  PickerPanel,
  priorityClass,
} from "@/components/tasks/MetadataPickers";
import type { OrgMember } from "@/types";

interface ProjectOption {
  id: string;
  name: string;
}

interface PhaseOption {
  id: string;
  name: string;
}

const TITLE_MAX = 256;

/**
 * GitHub-issue-style task creation page. Replaces the create flow of
 * `TaskFormDialog`. Edits still go through the dialog until inline editing
 * lands on `/tasks/[id]`.
 *
 * Optional `?projectId=<id>` query param pre-selects the project — the
 * project `TaskSection` deep-links to this page with that param so the
 * project context isn't lost.
 */
export default function NewTaskPage() {
  const t = useTranslations("tasks");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const { members } = useOrgMembers({ assignableOnly: false });

  const initialProjectId = searchParams.get("projectId") ?? "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>(initialProjectId);
  const [phaseId, setPhaseId] = useState<string>("");
  const [priority, setPriority] = useState<string>("medium");
  const [category, setCategory] = useState<string>("general");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Default the assignee to the current user once the session resolves.
  // Guarded so that explicitly unassigning doesn't snap back to "yourself".
  const assigneeInitRef = useRef(false);
  useEffect(() => {
    if (assigneeInitRef.current) return;
    if (session?.user?.id) {
      assigneeInitRef.current = true;
      setAssignedTo(session.user.id);
    }
  }, [session?.user?.id]);

  // Project list
  const { data: projectsRaw } = useSWR<ProjectOption[]>("/api/projects");
  const projects: ProjectOption[] = useMemo(
    () => (projectsRaw ?? []).map((p) => ({ id: p.id, name: p.name })),
    [projectsRaw]
  );

  // Phases for the selected project
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const fetchPhases = useCallback(async (pid: string) => {
    if (!pid) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const data = await projectsApi.get<{
        phases?: { id: string; name: string }[];
      }>(pid);
      setPhases((data.phases ?? []).map((p) => ({ id: p.id, name: p.name })));
    } catch {
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  }, []);
  useEffect(() => {
    if (projectId) fetchPhases(projectId);
    else setPhases([]);
  }, [projectId, fetchPhases]);

  const titleLength = title.length;
  const titleOver = titleLength > TITLE_MAX;
  const canSubmit = title.trim().length > 0 && !titleOver && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await tasksApi.create({
        title: title.trim(),
        description: description || undefined,
        projectId: projectId || undefined,
        phaseId: phaseId || undefined,
        priority,
        category,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || null,
      });
      toast({
        title: "Task created",
        description: `"${title.trim()}" has been created.`,
        variant: "success",
      });
      router.push(`/tasks/${created.id}`);
    } catch (err) {
      toast({
        title: "Couldn't create task",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "error",
      });
      setSubmitting(false);
    }
  }, [
    canSubmit,
    title,
    description,
    projectId,
    phaseId,
    priority,
    category,
    assignedTo,
    dueDate,
    router,
  ]);

  const cancelHref = initialProjectId
    ? `/projects/${initialProjectId}`
    : "/tasks";

  const selectedAssignee = members.find((m) => m.userId === assignedTo);
  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedPhase = phases.find((p) => p.id === phaseId);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb + heading */}
      <header className="border-b border-border-default pb-5 mb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-text-muted mb-3"
        >
          <Link href="/tasks" className="hover:text-text-primary">
            {t("pageTitle")}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary font-medium">New</span>
        </nav>
        <h1 className="text-2xl font-bold text-text-primary leading-tight">
          Open a new task
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Tasks track action items.
        </p>
      </header>

      {/*
       * TODO(Phase 4): Re-enable once the multi-domain Request entity ships.
       * Until then, only Tasks are supported and the segmented control is
       * commented out per Zaid's request.
       *
       * <div className="inline-flex items-center gap-1 p-1 rounded-lg ...">
       *   <SegmentButton active={type === "task"} icon={Check}>Task</SegmentButton>
       *   <SegmentButton active={type === "request"} icon={Send}>
       *     Request approval
       *   </SegmentButton>
       * </div>
       */}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start"
      >
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          {/* Title input */}
          <div className="rounded-lg bg-bg-secondary border border-border-default focus-within:border-accent transition-colors px-4 py-2.5 flex items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
              autoFocus
              className="flex-1 bg-transparent text-base font-medium text-text-primary placeholder:text-text-muted outline-none"
            />
            <span
              className={`text-[11px] tabular-nums shrink-0 ${
                titleOver ? "text-red-500" : "text-text-muted"
              }`}
            >
              {titleLength} / {TITLE_MAX}
            </span>
          </div>

          {/* Markdown editor */}
          <TaskMarkdownEditor value={description} onChange={setDescription} />

          {/* Submit row */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
            <Link
              href={cancelHref}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Creating…" : "Create task"}
            </Button>
          </div>
        </div>

        {/* Sidebar — single card with sections, offset to align with title input */}
        <aside style={{ marginTop: 12 }}>
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
                  isSelected={(m) => m.userId === assignedTo}
                  onSelect={(m) => {
                    // Stay open — user can toggle multiple times. Clicking
                    // outside closes (Radix Popover default behaviour).
                    setAssignedTo(m.userId === assignedTo ? "" : m.userId);
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
                  <span className="text-sm text-text-muted">
                    No one assigned
                  </span>
                  {session?.user?.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignedTo(session.user.id);
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
                  isSelected={(p) => p.id === projectId}
                  onSelect={(p) => {
                    setProjectId(p.id === projectId ? "" : p.id);
                    setPhaseId("");
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
                  isSelected={(p) => p.id === phaseId}
                  onSelect={(p) => {
                    setPhaseId(p.id === phaseId ? "" : p.id);
                    close();
                  }}
                  renderOption={(p) => (
                    <span className="text-sm text-text-primary">{p.name}</span>
                  )}
                  emptyHint={
                    !projectId
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
                  : !projectId
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
                      dueDate ? new Date(dueDate + "T00:00:00") : undefined
                    }
                    onSelect={(date) => {
                      setDueDate(date ? format(date, "yyyy-MM-dd") : "");
                      close();
                    }}
                    defaultMonth={
                      dueDate ? new Date(dueDate + "T00:00:00") : undefined
                    }
                  />
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate("");
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
              {dueDate ? (
                <span className="text-sm text-text-primary">
                  {format(new Date(dueDate + "T00:00:00"), "MMM d, yyyy")}
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
                  isSelected={(p) => p === priority}
                  onSelect={(p) => {
                    setPriority(p);
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
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(priority)}`}
              >
                <Flag className="w-3 h-3" />
                {capitalize(priority)}
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
                  isSelected={(c) => c === category}
                  onSelect={(c) => {
                    setCategory(c);
                    close();
                  }}
                  renderOption={(c) => (
                    <span className="text-sm text-text-primary">
                      {capitalize(c)}
                    </span>
                  )}
                />
              )}
            >
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
                <Tag className="w-3 h-3" />
                {capitalize(category)}
              </span>
            </FieldCard>
          </div>
        </aside>
      </form>
    </div>
  );
}

// FieldCard, PickerPanel, priorityClass live in
// src/components/tasks/MetadataPickers.tsx so /tasks/[id] can share them.
