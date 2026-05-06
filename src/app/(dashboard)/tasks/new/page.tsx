"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/authClient";
import { tasks as tasksApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { TaskMarkdownEditor } from "@/components/tasks/TaskMarkdownEditor";
import {
  TaskMetadataSidebar,
  type TaskMetadataValues,
} from "@/components/tasks/TaskMetadataSidebar";

const TITLE_MAX = 256;

/**
 * GitHub-issue-style task creation page. Edits happen inline on
 * `/tasks/[id]`.
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

  const initialProjectId = searchParams.get("projectId") || null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Assignee defaults to the current session user. `null` = not yet
  // customised (still tracking the session); once the user picks anything
  // the override sticks (including null for explicit unassign).
  const [assignedToOverride, setAssignedToOverride] = useState<{
    value: string | null;
  } | null>(null);
  const sessionUserId = session?.user?.id ?? null;
  const assignedTo =
    assignedToOverride !== null ? assignedToOverride.value : sessionUserId;

  const [metadata, setMetadata] = useState<
    Omit<TaskMetadataValues, "assignedTo">
  >({
    projectId: initialProjectId,
    phaseId: null,
    dueDate: null,
    priority: "medium",
    category: "general",
  });

  const values: TaskMetadataValues = { ...metadata, assignedTo };

  const onMetadataChange = useCallback((patch: Partial<TaskMetadataValues>) => {
    if (Object.prototype.hasOwnProperty.call(patch, "assignedTo")) {
      setAssignedToOverride({ value: patch.assignedTo ?? null });
    }
    const { assignedTo: _ignored, ...rest } = patch;
    void _ignored;
    if (Object.keys(rest).length > 0) {
      setMetadata((prev) => ({ ...prev, ...rest }));
    }
  }, []);

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
        projectId: values.projectId || undefined,
        phaseId: values.phaseId || undefined,
        priority: values.priority,
        category: values.category,
        assignedTo: values.assignedTo || undefined,
        dueDate: values.dueDate || null,
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
    values.projectId,
    values.phaseId,
    values.priority,
    values.category,
    values.assignedTo,
    values.dueDate,
    router,
  ]);

  const cancelHref = initialProjectId
    ? `/projects/${initialProjectId}`
    : "/tasks";

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start"
      >
        {/* Main column */}
        <div className="space-y-4 min-w-0">
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

          <TaskMarkdownEditor value={description} onChange={setDescription} />

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

        <aside className="mt-3">
          <TaskMetadataSidebar
            values={values}
            onChange={onMetadataChange}
            currentUserId={sessionUserId}
          />
        </aside>
      </form>
    </div>
  );
}
