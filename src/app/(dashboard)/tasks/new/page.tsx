"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  Loader2,
  ListChecks,
  Paperclip,
  X,
  CloudUpload,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFileDropzone } from "@/hooks/useFileDropzone";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { authClient } from "@/lib/authClient";
import { tasks as tasksApi, upload, projects as projectsApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { PRIORITIES, CATEGORIES, capitalize } from "@/lib/taskUtils";
import {
  getFileExtension,
  fileTypeBadge,
  formatFileSize,
  MAX_UPLOAD_SIZE,
} from "@/lib/fileUtils";

interface ProjectOption {
  id: string;
  name: string;
}

interface PhaseOption {
  id: string;
  name: string;
}

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
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Default the assignee to the current user once the session resolves.
  useEffect(() => {
    if (!assignedTo && session?.user?.id) {
      setAssignedTo(session.user.id);
    }
  }, [assignedTo, session?.user?.id]);

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

  // Fire phase fetch on initial project (from query param) or when it changes.
  useEffect(() => {
    if (projectId) {
      fetchPhases(projectId);
    } else {
      setPhases([]);
    }
  }, [projectId, fetchPhases]);

  // Checklist
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const addChecklistItem = useCallback(() => {
    const trimmed = newChecklistItem.trim();
    if (!trimmed) return;
    setChecklistItems((items) => [...items, trimmed]);
    setNewChecklistItem("");
  }, [newChecklistItem]);
  const removeChecklistItem = useCallback((index: number) => {
    setChecklistItems((items) => items.filter((_, i) => i !== index));
  }, []);

  // File attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const tooLarge = incoming.filter((f) => f.size > MAX_UPLOAD_SIZE);
    if (tooLarge.length > 0) {
      toast({
        title: "File too large",
        description: `${tooLarge.map((f) => f.name).join(", ")} exceed${
          tooLarge.length === 1 ? "s" : ""
        } the 50 MB limit.`,
        variant: "error",
      });
    }
    const valid = incoming.filter((f) => f.size <= MAX_UPLOAD_SIZE);
    if (valid.length === 0) return;
    setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const { dragOver, handleDrop, handleDragOver, handleDragLeave } =
    useFileDropzone(addFiles);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canSubmit = title.trim().length > 0 && !submitting;

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

      // Post-create: checklist items + file uploads (parallel where safe).
      const postCreate: Promise<unknown>[] = [];
      if (checklistItems.length > 0) {
        postCreate.push(
          (async () => {
            for (const itemTitle of checklistItems) {
              await tasksApi.addChecklistItem(created.id, itemTitle);
            }
          })()
        );
      }
      for (const file of pendingFiles) {
        postCreate.push(
          upload.uploadFile(file).then((result) =>
            tasksApi.addAttachment(created.id, {
              fileUrl: result.url,
              fileName: result.fileName,
              fileSize: file.size,
            })
          )
        );
      }
      if (postCreate.length > 0) {
        try {
          await Promise.all(postCreate);
        } catch (err) {
          console.error("Post-create attachment error:", err);
          toast({
            title: "Task created with issues",
            description:
              "Some checklist items or attachments failed to save. You can add them from the task detail view.",
            variant: "warning",
          });
        }
      }

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
    checklistItems,
    pendingFiles,
    router,
  ]);

  const cancelHref = initialProjectId
    ? `/projects/${initialProjectId}`
    : "/tasks";

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb + heading */}
      <header className="border-b border-border-default pb-5 mb-5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-text-muted mb-3"
        >
          <Link href="/tasks" className="hover:text-text-primary">
            {t("pageTitle")}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span>{t("newTask")}</span>
        </nav>
        <h1 className="text-2xl font-bold text-text-primary leading-tight">
          {t("newTask")}
        </h1>
        <p className="mt-2 text-sm text-text-muted">{t("pageSubtitle")}</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          <Input
            label={t("title")}
            placeholder={t("titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("description")}
            </label>
            <textarea
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y"
            />
          </div>

          {/* Checklist */}
          <ChecklistField
            items={checklistItems}
            newItem={newChecklistItem}
            setNewItem={setNewChecklistItem}
            onAdd={addChecklistItem}
            onRemove={removeChecklistItem}
          />

          {/* Attachments */}
          <AttachmentsField
            files={pendingFiles}
            dragOver={dragOver}
            fileInputRef={fileInputRef}
            onAddFiles={addFiles}
            onRemove={removeFile}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />

          {/* Submit row */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
            <Link
              href={cancelHref}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("cancel") ?? "Cancel"}
            </Link>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Creating…" : t("createTask")}
            </Button>
          </div>
        </div>

        {/* Sidebar — metadata pickers */}
        <aside className="space-y-3">
          <SidebarField label={t("project")}>
            <Select
              value={projectId || "none"}
              onValueChange={(v) => {
                setProjectId(v === "none" ? "" : v);
                setPhaseId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("noProject")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noProject")}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarField>

          <SidebarField label={t("phase")}>
            <Select
              value={phaseId || "none"}
              onValueChange={(v) => setPhaseId(v === "none" ? "" : v)}
              disabled={!projectId || loadingPhases}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingPhases ? t("loading") : t("noPhase")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noPhase")}</SelectItem>
                {phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarField>

          <SidebarField label={t("assignedTo")}>
            <Select
              value={assignedTo || "none"}
              onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("unassigned")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.user.name || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarField>

          <SidebarField label={t("priority")}>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {capitalize(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarField>

          <SidebarField label={t("category")}>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {capitalize(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarField>

          <SidebarField label={t("dueDate")}>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </SidebarField>
        </aside>
      </form>

      {!projectsRaw && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-32" />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface SidebarFieldProps {
  label: string;
  children: React.ReactNode;
}

function SidebarField({ label, children }: SidebarFieldProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-4 py-3">
      <h3 className="text-[10px] font-semibold tracking-widest text-text-muted uppercase mb-2">
        {label}
      </h3>
      {children}
    </div>
  );
}

interface ChecklistFieldProps {
  items: string[];
  newItem: string;
  setNewItem: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function ChecklistField({
  items,
  newItem,
  setNewItem,
  onAdd,
  onRemove,
}: ChecklistFieldProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            Checklist
          </span>
        </div>
        <span className="text-[11px] text-text-muted">Optional</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Add item..."
          className="flex-1 text-[13px] bg-transparent border border-border-default rounded-md px-2.5 py-1.5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!newItem.trim()}
          className="px-3 py-1.5 rounded-md bg-accent text-text-on-accent text-xs font-semibold disabled:opacity-30 hover:bg-accent/90 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1.5 px-2 rounded group hover:bg-bg-elevated/50"
            >
              <div className="w-4 h-4 rounded-[3px] border-[1.5px] border-text-muted shrink-0 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-transparent" />
              </div>
              <span className="flex-1 text-[13px] text-text-primary truncate">
                {item}
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer"
                aria-label="Remove item"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AttachmentsFieldProps {
  files: File[];
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAddFiles: (files: FileList | File[]) => void;
  onRemove: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function AttachmentsField({
  files,
  dragOver,
  fileInputRef,
  onAddFiles,
  onRemove,
  onDragOver,
  onDragLeave,
  onDrop,
}: AttachmentsFieldProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            Attachments
          </span>
        </div>
        <span className="text-[11px] text-text-muted">Optional</span>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border border-dashed cursor-pointer transition-colors ${
          dragOver
            ? "border-accent bg-accent/5"
            : "border-border-default hover:border-text-muted"
        }`}
      >
        <CloudUpload className="w-5 h-5 text-text-muted" />
        <p className="text-[13px] text-text-muted">
          Drop files here or{" "}
          <span className="font-medium text-accent">browse</span>
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map((file, i) => {
            const ext = getFileExtension(file.name);
            const badge = fileTypeBadge(ext);
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-md bg-bg-elevated/50 group"
              >
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
                <span className="flex-1 text-[13px] text-text-primary truncate">
                  {file.name}
                </span>
                <span className="text-[11px] text-text-muted shrink-0">
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="p-0.5 rounded text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                  aria-label="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
