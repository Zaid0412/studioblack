"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import {
  Folder,
  Layers,
  Calendar as CalendarIcon,
  Flag,
  Tag,
  User,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { API } from "@/lib/api/routes";
import {
  PRIORITIES,
  CATEGORIES,
  PRIORITY_ICON,
  CATEGORY_ICON,
  capitalize,
  formatDate,
  priorityClass,
} from "@/lib/taskUtils";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { FieldCard, PickerPanel } from "./MetadataPickers";
import type { OrgMember, TaskCategory, TaskPriority } from "@/types";

interface ProjectOption {
  id: string;
  name: string;
}
interface PhaseOption {
  id: string;
  name: string;
}

/**
 * The six task metadata fields surfaced in both the create page
 * (`/tasks/new`) and the detail page (`/tasks/[id]`). Names match the
 * server-side camelCase API shape used by `tasksApi.update`, so the
 * `/tasks/[id]` consumer can pass `onChange` straight through.
 */
export interface TaskMetadataValues {
  assignedTo: string | null;
  projectId: string | null;
  phaseId: string | null;
  /** ISO date `yyyy-MM-dd` or null for unset. */
  dueDate: string | null;
  priority: string;
  category: string;
}

interface ReadOnlyLabels {
  assignedToName: string | null;
  projectName: string | null;
  phaseName: string | null;
}

interface TaskMetadataSidebarProps {
  values: TaskMetadataValues;
  /**
   * Apply a partial patch. Editable surfaces should accept all six keys
   * — the create page maps these to `setX` calls, the detail page calls
   * `tasksApi.update` with the patch.
   */
  onChange: (patch: Partial<TaskMetadataValues>) => void;
  /** Drives the "Assign yourself" CTA when no assignee is set. */
  currentUserId: string | null;
  /**
   * Read-only mode. Pass the labels to display (typically pulled from
   * the task itself: `assigned_to_name`, `project_name`, `phase_name`).
   * No pickers render, no edit fetches fire.
   */
  readOnlyLabels?: ReadOnlyLabels;
}

/**
 * Single source of truth for the task metadata sidebar. Used by:
 * - `/tasks/new` (editable, no readOnlyLabels)
 * - `/tasks/[id]` editable variant (no readOnlyLabels)
 * - `/tasks/[id]` read-only variant for non-editors (with readOnlyLabels)
 *
 * Was previously triplicated across those three sites.
 */
export function TaskMetadataSidebar(props: TaskMetadataSidebarProps) {
  if (props.readOnlyLabels) {
    return <ReadOnlySidebar {...props} labels={props.readOnlyLabels} />;
  }
  return <EditableSidebar {...props} />;
}

// ─── Editable variant ───────────────────────────────────────────────────────

function EditableSidebar({
  values,
  onChange,
  currentUserId,
}: TaskMetadataSidebarProps) {
  const { members } = useOrgMembers({ assignableOnly: false });
  const { data: projects = [] } = useSWR<ProjectOption[]>(API.projects());

  const { data: projectDetail, isLoading: loadingPhases } = useSWR<{
    phases?: PhaseOption[];
  }>(values.projectId ? API.project(values.projectId) : null);
  const phases = useMemo(
    () => projectDetail?.phases ?? [],
    [projectDetail?.phases]
  );

  const selectedAssignee = useMemo(
    () => members.find((m) => m.userId === values.assignedTo),
    [members, values.assignedTo]
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === values.projectId),
    [projects, values.projectId]
  );
  const selectedPhase = useMemo(
    () => phases.find((p) => p.id === values.phaseId),
    [phases, values.phaseId]
  );

  const SelectedPriorityIcon =
    PRIORITY_ICON[values.priority as TaskPriority] ?? Flag;
  const SelectedCategoryIcon =
    CATEGORY_ICON[values.category as TaskCategory] ?? Tag;

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
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
            isSelected={(m) => m.userId === values.assignedTo}
            onSelect={(m) => {
              const next = m.userId === values.assignedTo ? null : m.userId;
              onChange({ assignedTo: next });
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
                  onChange({ assignedTo: currentUserId });
                }}
                className="block text-xs text-accent-strong hover:underline"
              >
                Assign yourself
              </button>
            )}
          </div>
        )}
      </FieldCard>

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
            isSelected={(p) => p.id === values.projectId}
            onSelect={(p) => {
              const next = p.id === values.projectId ? null : p.id;
              // Switching project clears the phase — phases belong to a
              // specific project, so the old phase id is no longer valid.
              onChange({ projectId: next, phaseId: null });
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
            isSelected={(p) => p.id === values.phaseId}
            onSelect={(p) => {
              const next = p.id === values.phaseId ? null : p.id;
              onChange({ phaseId: next });
              close();
            }}
            renderOption={(p) => (
              <span className="text-sm text-text-primary">{p.name}</span>
            )}
            emptyHint={
              !values.projectId
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
            : !values.projectId
              ? "—"
              : loadingPhases
                ? "Loading…"
                : "No phase"}
        </span>
      </FieldCard>

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
                values.dueDate
                  ? new Date(values.dueDate + "T00:00:00")
                  : undefined
              }
              onSelect={(date) => {
                onChange({
                  dueDate: date ? format(date, "yyyy-MM-dd") : null,
                });
                close();
              }}
              defaultMonth={
                values.dueDate
                  ? new Date(values.dueDate + "T00:00:00")
                  : undefined
              }
            />
            {values.dueDate && (
              <button
                type="button"
                onClick={() => {
                  onChange({ dueDate: null });
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
        {values.dueDate ? (
          <span className="text-sm text-text-primary">
            {formatDate(values.dueDate)}
          </span>
        ) : (
          <span className="text-sm text-text-muted">No due date</span>
        )}
      </FieldCard>

      <FieldCard
        icon={Flag}
        label="Priority"
        divider
        picker={(close) => (
          <PickerPanel
            title="Set priority"
            options={PRIORITIES as readonly string[]}
            getKey={(p) => p}
            isSelected={(p) => p === values.priority}
            onSelect={(p) => {
              onChange({ priority: p });
              close();
            }}
            renderOption={(p) => {
              const PIcon = PRIORITY_ICON[p as TaskPriority] ?? Flag;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(p)}`}
                >
                  <PIcon className="w-3 h-3" />
                  {capitalize(p)}
                </span>
              );
            }}
          />
        )}
      >
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(values.priority)}`}
        >
          <SelectedPriorityIcon className="w-3 h-3" />
          {capitalize(values.priority)}
        </span>
      </FieldCard>

      <FieldCard
        icon={Tag}
        label="Category"
        picker={(close) => (
          <PickerPanel
            title="Pick a category"
            options={CATEGORIES as readonly string[]}
            getKey={(c) => c}
            isSelected={(c) => c === values.category}
            onSelect={(c) => {
              onChange({ category: c });
              close();
            }}
            renderOption={(c) => {
              const CIcon = CATEGORY_ICON[c as TaskCategory] ?? Tag;
              return (
                <span className="inline-flex items-center gap-2 text-sm text-text-primary">
                  <CIcon className="w-3.5 h-3.5 text-text-muted" />
                  {capitalize(c)}
                </span>
              );
            }}
          />
        )}
      >
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
          <SelectedCategoryIcon className="w-3 h-3" />
          {capitalize(values.category)}
        </span>
      </FieldCard>
    </div>
  );
}

// ─── Read-only variant ──────────────────────────────────────────────────────

function ReadOnlySidebar({
  values,
  labels,
}: TaskMetadataSidebarProps & { labels: ReadOnlyLabels }) {
  const PriorityIcon = PRIORITY_ICON[values.priority as TaskPriority] ?? Flag;
  const CategoryIcon = CATEGORY_ICON[values.category as TaskCategory] ?? Tag;
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary divide-y divide-border-default">
      <ReadRow icon={User} label="Assignees">
        {labels.assignedToName ? (
          <div className="flex items-center gap-2">
            <Avatar
              initials={deriveInitials(labels.assignedToName)}
              color={avatarColor(values.assignedTo ?? labels.assignedToName)}
              size="sm"
            />
            <span className="text-sm text-text-primary">
              {labels.assignedToName}
            </span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">No one assigned</span>
        )}
      </ReadRow>
      <ReadRow icon={Folder} label="Project">
        {labels.projectName ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
            <Folder className="w-3 h-3" />
            {labels.projectName}
          </span>
        ) : (
          <span className="text-sm text-text-muted">No project</span>
        )}
      </ReadRow>
      <ReadRow icon={Layers} label="Phase">
        <span className="text-sm text-text-primary">
          {labels.phaseName ?? "—"}
        </span>
      </ReadRow>
      <ReadRow icon={CalendarIcon} label="Due date">
        <span className="text-sm text-text-primary">
          {values.dueDate ? formatDate(values.dueDate) : "—"}
        </span>
      </ReadRow>
      <ReadRow icon={Flag} label="Priority">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass(values.priority)}`}
        >
          <PriorityIcon className="w-3 h-3" />
          {capitalize(values.priority)}
        </span>
      </ReadRow>
      <ReadRow icon={Tag} label="Category">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
          <CategoryIcon className="w-3 h-3" />
          {capitalize(values.category)}
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
      <div>{children}</div>
    </div>
  );
}
