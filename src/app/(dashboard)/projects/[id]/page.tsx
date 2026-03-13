"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Upload,
  ArrowLeft,
  Edit,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
  MessageSquare,
  Send,
  Plus,
  UserPlus,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { deriveInitials } from "@/lib/utils";

interface Phase {
  id: string;
  name: string;
  phase_order: number;
  status: string;
}

interface Member {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  description: string;
  phase_id: string | null;
  uploaded_by_name: string;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_role: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  requires_client_review: boolean;
  review_status: string | null;
  due_date: string | null;
  created_at: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  status: string;
  description: string;
  deadline: string | null;
  created_at: string;
  phases: Phase[];
  members: Member[];
}

const phaseStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-warning" />;
    case "not_started":
    default:
      return <AlertCircle className="w-4 h-4 text-text-muted" />;
  }
};

/** Project detail page with phases and team. */
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const tc = useTranslations("common");
  const te = useTranslations("emptyStates");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [tasksByPhase, setTasksByPhase] = useState<Map<string, Task[]>>(new Map());
  const [addingTaskPhase, setAddingTaskPhase] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      }),
      fetch(`/api/projects/${id}/attachments?all=true`).then((res) => {
        if (!res.ok) return [];
        return res.json();
      }),
      fetch(`/api/projects/${id}/comments`).then((res) => {
        if (!res.ok) return [];
        return res.json();
      }),
    ])
      .then(([projectData, attachData, commentData]) => {
        setProject(projectData);
        setAttachments(attachData);
        setComments(commentData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
        if (!tasksByPhase.has(phaseId)) fetchTasks(phaseId);
      }
      return next;
    });
  };

  const getPhaseAttachments = (phaseId: string) =>
    attachments.filter((a) => a.phase_id === phaseId);

  const getGeneralAttachments = () =>
    attachments.filter((a) => !a.phase_id);

  const handleSendComment = async () => {
    if (!newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/projects/${id}/comments`).then((r) =>
          r.ok ? r.json() : []
        );
        setComments(updated);
        setNewComment("");
      }
    } finally {
      setSendingComment(false);
    }
  };

  const fetchTasks = async (phaseId: string) => {
    const res = await fetch(`/api/projects/${id}/tasks?phaseId=${phaseId}`);
    if (res.ok) {
      const tasks = await res.json();
      setTasksByPhase((prev) => new Map(prev).set(phaseId, tasks));
    }
  };

  const handleAddTask = async (phaseId: string) => {
    if (!newTaskTitle.trim() || savingTask) return;
    setSavingTask(true);
    try {
      const res = await fetch(`/api/projects/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseId,
          title: newTaskTitle.trim(),
          assignedTo: newTaskAssignee || undefined,
          dueDate: newTaskDueDate || undefined,
        }),
      });
      if (res.ok) {
        await fetchTasks(phaseId);
        setNewTaskTitle("");
        setNewTaskAssignee("");
        setNewTaskDueDate("");
        setAddingTaskPhase(null);
      }
    } finally {
      setSavingTask(false);
    }
  };

  const handleRequestReview = async (taskId: string, phaseId: string) => {
    await fetch(`/api/projects/${id}/tasks/${taskId}/request-review`, {
      method: "POST",
    });
    await fetchTasks(phaseId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">{tc("projectNotFound")}</p>
      </div>
    );
  }

  const client = project.client_name || project.client_email || "—";

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Back button */}
      <button
        onClick={() => router.push("/projects")}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc("backToProjects")}
      </button>

      <PageHeader
        title={project.name}
        subtitle={project.description}
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push(`/projects/${id}/edit`)}
            >
              <Edit className="w-4 h-4" />
              {t("editButton")}
            </Button>
            <Button onClick={() => router.push(`/projects/${id}/upload`)}>
              <Upload className="w-4 h-4" />
              {t("uploadDesign")}
            </Button>
          </div>
        }
      />

      {/* Project info row */}
      <div className="flex gap-6">
        <div className="flex-1 flex flex-col gap-6">
          {/* Project meta */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t("clientLabel")}</span>
              <span className="text-text-primary font-medium">{client}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t("statusLabel")}</span>
              <Badge variant={statusToBadgeVariant(project.status as Parameters<typeof statusToBadgeVariant>[0])}>
                {project.status.charAt(0).toUpperCase() +
                  project.status.slice(1)}
              </Badge>
            </div>
            {project.deadline && (
              <div className="flex items-center gap-2 text-text-muted">
                <Calendar className="w-3.5 h-3.5 text-warning" />
                <span>
                  {t("duePrefix")}{" "}
                  {new Date(project.deadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Team */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("teamMembers")}
            </h3>
            {project.members.length === 0 ? (
              <p className="text-sm text-text-muted">No team members assigned.</p>
            ) : (
              <div className="flex gap-3">
                {project.members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2"
                  >
                    <Avatar initials={deriveInitials(member.name)} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">
                        {member.name}
                      </span>
                      <span className="text-xs text-text-muted capitalize">
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phases */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("designSections")}
            </h3>
            {project.phases.length === 0 ? (
              <EmptyState
                icon={Upload}
                title={te("designSectionsTitle")}
                description={te("designSectionsDescription")}
                action={{
                  label: te("designSectionsAction"),
                  href: `/projects/${id}/upload`,
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {project.phases.map((phase) => {
                  const isExpanded = expandedPhases.has(phase.id);
                  const phaseFiles = getPhaseAttachments(phase.id);
                  return (
                    <div key={phase.id}>
                      <Card
                        hover
                        className="!p-4 cursor-pointer"
                        onClick={() => togglePhase(phase.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {phaseStatusIcon(phase.status)}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold text-text-primary">
                                {phase.phase_order}. {phase.name}
                              </span>
                              <span className="text-xs text-text-muted capitalize">
                                {phase.status.replace("_", " ")}
                                {phaseFiles.length > 0 && (
                                  <span className="ml-2 text-accent">
                                    · {phaseFiles.length} file{phaseFiles.length !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-text-muted" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-text-muted" />
                            )}
                          </div>
                        </div>
                      </Card>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="ml-4 mt-2 mb-1 flex flex-col gap-3 border-l-2 border-border-light pl-4">
                          {/* Phase attachments */}
                          {phaseFiles.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {phaseFiles.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2 hover:bg-bg-hover transition-colors"
                                >
                                  <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-sm text-text-primary truncate">
                                      {att.file_name}
                                    </span>
                                    <span className="text-xs text-text-muted">
                                      {att.uploaded_by_name} ·{" "}
                                      {new Date(att.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-text-muted py-1">
                              No files uploaded for this phase yet.
                            </p>
                          )}

                          {/* Tasks */}
                          {(() => {
                            const tasks = tasksByPhase.get(phase.id) || [];
                            return (
                              <div className="flex flex-col gap-2">
                                {tasks.length > 0 && (
                                  <span className="text-xs font-semibold text-text-secondary mt-1">
                                    Tasks ({tasks.length})
                                  </span>
                                )}
                                {tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2"
                                  >
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <span className="text-sm text-text-primary">
                                        {task.title}
                                      </span>
                                      <span className="text-xs text-text-muted">
                                        {task.assigned_name || "Unassigned"}
                                        {task.due_date &&
                                          ` · Due ${new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {task.review_status === "pending_review" && (
                                        <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                                          Pending Review
                                        </span>
                                      )}
                                      {task.review_status === "approved" && (
                                        <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                                          Approved
                                        </span>
                                      )}
                                      {task.review_status === "changes_requested" && (
                                        <span className="text-[10px] font-medium text-error bg-error/10 px-2 py-0.5 rounded-full">
                                          Changes Requested
                                        </span>
                                      )}
                                      {!task.requires_client_review && (
                                        <button
                                          onClick={() => handleRequestReview(task.id, phase.id)}
                                          className="text-[10px] font-medium text-accent hover:text-accent/80 bg-accent/10 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1"
                                          title="Request client review"
                                        >
                                          <Eye className="w-3 h-3" />
                                          Request Review
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Add task form */}
                                {addingTaskPhase === phase.id ? (
                                  <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-primary p-3">
                                    <input
                                      type="text"
                                      value={newTaskTitle}
                                      onChange={(e) => setNewTaskTitle(e.target.value)}
                                      placeholder="Task title"
                                      className="w-full rounded-md border border-border-default bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <select
                                        value={newTaskAssignee}
                                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                                        className="flex-1 rounded-md border border-border-default bg-bg-input px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                                      >
                                        <option value="">Assign to...</option>
                                        {project?.members.map((m) => (
                                          <option key={m.user_id} value={m.user_id}>
                                            {m.name} ({m.role})
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="date"
                                        value={newTaskDueDate}
                                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                                        className="rounded-md border border-border-default bg-bg-input px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                                      />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        variant="secondary"
                                        className="!py-1 !px-3 !text-xs"
                                        onClick={() => {
                                          setAddingTaskPhase(null);
                                          setNewTaskTitle("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        className="!py-1 !px-3 !text-xs"
                                        onClick={() => handleAddTask(phase.id)}
                                        disabled={!newTaskTitle.trim() || savingTask}
                                      >
                                        {savingTask ? "Saving..." : "Add Task"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAddingTaskPhase(phase.id)}
                                    className="self-start flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors mt-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Task
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* Upload to this phase button */}
                          <Button
                            variant="secondary"
                            className="self-start !py-1.5 !px-3 !text-xs"
                            onClick={() =>
                              router.push(
                                `/projects/${id}/upload?phaseId=${phase.id}&phaseName=${encodeURIComponent(phase.name)}`
                              )
                            }
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload to this phase
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* General Attachments (not tied to a phase) */}
          {getGeneralAttachments().length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-primary">
                General Attachments
              </h3>
              <div className="flex flex-col gap-2">
                {getGeneralAttachments().map((att) => (
                  <a
                    key={att.id}
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2 hover:bg-bg-hover transition-colors"
                  >
                    <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm text-text-primary truncate">
                        {att.file_name}
                      </span>
                      <span className="text-xs text-text-muted">
                        {att.uploaded_by_name} ·{" "}
                        {new Date(att.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {/* Comments section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comments ({comments.length})
            </h3>

            <div className="flex gap-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
                placeholder="Leave a comment..."
                className="flex-1 rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                rows={2}
              />
              <Button
                size="sm"
                className="self-end"
                onClick={handleSendComment}
                disabled={!newComment.trim() || sendingComment}
              >
                {sendingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            {comments.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No comments yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        initials={deriveInitials(comment.user_name)}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-text-primary">
                          {comment.user_name}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {new Date(comment.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
