"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Calendar,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Paperclip,
  MessageSquare,
  Send,
  AlertTriangle,
  History,
  ClipboardCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  task_id: string | null;
  uploaded_by_name: string;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

interface Approval {
  id: string;
  decision: "approved" | "changes_requested";
  comment: string;
  user_name: string;
  created_at: string;
}

interface PendingTask {
  id: string;
  title: string;
  description: string;
  phase_name: string;
  assigned_name: string | null;
  review_status: string;
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

/** Client project detail page — read-only view with phases and attachments. */
export default function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const tc = useTranslations("common");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      fetch(`/api/projects/${id}/approvals`).then((res) => {
        if (!res.ok) return [];
        return res.json();
      }),
      fetch(`/api/projects/${id}/tasks/pending-review`).then((res) => {
        if (!res.ok) return [];
        return res.json();
      }),
    ])
      .then(([projectData, attachmentData, commentData, approvalData, pendingTaskData]) => {
        setProject(projectData);
        setAttachments(attachmentData);
        setComments(commentData);
        setApprovals(approvalData);
        setPendingTasks(pendingTaskData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

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
        // Refetch comments
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

  const handleDecision = async (decision: "approved" | "changes_requested", comment?: string) => {
    if (submittingDecision) return;
    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/projects/${id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || "" }),
      });
      if (res.ok) {
        // Refetch approvals and project (status may have changed)
        const [updatedApprovals, updatedProject] = await Promise.all([
          fetch(`/api/projects/${id}/approvals`).then((r) => r.ok ? r.json() : []),
          fetch(`/api/projects/${id}`).then((r) => r.ok ? r.json() : null),
        ]);
        setApprovals(updatedApprovals);
        if (updatedProject) setProject(updatedProject);
      }
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleTaskReview = async (taskId: string, action: "approved" | "changes_requested", comment?: string) => {
    setReviewingTaskId(taskId);
    try {
      const res = await fetch(`/api/projects/${id}/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || "" }),
      });
      if (res.ok) {
        // Remove from pending list
        setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } finally {
      setReviewingTaskId(null);
    }
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

  // Group attachments by phase
  const attachmentsByPhase = new Map<string, Attachment[]>();
  const projectLevelAttachments: Attachment[] = [];
  for (const att of attachments) {
    if (att.phase_id) {
      const list = attachmentsByPhase.get(att.phase_id) || [];
      list.push(att);
      attachmentsByPhase.set(att.phase_id, list);
    } else {
      projectLevelAttachments.push(att);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Back button */}
      <button
        onClick={() => router.push("/client-dashboard/projects")}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc("backToProjects")}
      </button>

      <PageHeader title={project.name} subtitle={project.description} />

      {/* Project meta */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-text-muted">{t("statusLabel")}</span>
          <Badge variant={statusToBadgeVariant(project.status as Parameters<typeof statusToBadgeVariant>[0])}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <span>Category:</span>
          <span className="text-text-primary capitalize">{project.category}</span>
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
      {project.members.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("teamMembers")}
          </h3>
          <div className="flex gap-3 flex-wrap">
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
        </div>
      )}

      {/* Phases with inline attachments */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("designSections")}
        </h3>
        {project.phases.length === 0 ? (
          <p className="text-sm text-text-muted">No phases yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {project.phases.map((phase) => {
              const phaseFiles = attachmentsByPhase.get(phase.id) || [];
              return (
                <Card key={phase.id} className="!p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {phaseStatusIcon(phase.status)}
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-sm font-semibold text-text-primary">
                          {phase.phase_order}. {phase.name}
                        </span>
                        <span className="text-xs text-text-muted capitalize">
                          {phase.status.replace("_", " ")}
                        </span>
                      </div>
                      {phaseFiles.length > 0 && (
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {phaseFiles.length} file{phaseFiles.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Phase attachments */}
                    {phaseFiles.length > 0 && (
                      <div className="flex flex-col gap-2 pl-7 border-t border-border-default pt-3">
                        {phaseFiles.map((att) => (
                          <a
                            key={att.id}
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg bg-bg-primary px-3 py-2 hover:bg-bg-elevated transition-colors group"
                          >
                            <FileText className="w-4 h-4 text-accent shrink-0" />
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-sm text-text-primary truncate">
                                {att.file_name}
                              </span>
                              {att.description && (
                                <span className="text-xs text-text-muted truncate">
                                  {att.description}
                                </span>
                              )}
                              <span className="text-[11px] text-text-muted">
                                Uploaded by {att.uploaded_by_name} &middot;{" "}
                                {new Date(att.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            <Download className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Project-level attachments (not tied to a phase) */}
      {projectLevelAttachments.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Documents
          </h3>
          <div className="flex flex-col gap-2">
            {projectLevelAttachments.map((att) => (
              <a
                key={att.id}
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg bg-bg-elevated px-4 py-3 hover:bg-bg-elevated/80 transition-colors group"
              >
                <FileText className="w-4 h-4 text-accent shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm text-text-primary truncate">
                    {att.file_name}
                  </span>
                  {att.description && (
                    <span className="text-xs text-text-muted truncate">
                      {att.description}
                    </span>
                  )}
                  <span className="text-[11px] text-text-muted">
                    Uploaded by {att.uploaded_by_name} &middot;{" "}
                    {new Date(att.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <Download className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty state if no attachments at all */}
      {attachments.length === 0 && (
        <EmptyState
          icon={Paperclip}
          title="No documents yet"
          description="The architect hasn't uploaded any documents for this project yet."
        />
      )}

      {/* Tasks Pending Your Review */}
      {pendingTasks.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Tasks Pending Your Review ({pendingTasks.length})
          </h3>
          <div className="flex flex-col gap-2">
            {pendingTasks.map((task) => (
              <Card key={task.id} className="!p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary">
                        {task.title}
                      </span>
                      <span className="text-xs text-text-muted">
                        Phase: {task.phase_name}
                        {task.assigned_name && ` · By ${task.assigned_name}`}
                      </span>
                      {task.description && (
                        <span className="text-xs text-text-secondary mt-1">
                          {task.description}
                        </span>
                      )}
                    </div>
                    <Badge variant="warning">Pending Review</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleTaskReview(task.id, "approved")}
                      disabled={reviewingTaskId === task.id}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {reviewingTaskId === task.id ? "..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTaskReview(task.id, "changes_requested")}
                      disabled={reviewingTaskId === task.id}
                      className="flex-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Request Changes
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approval decision — only show when project is active but NO pending task reviews (general project-level approval) */}
      {project.status !== "completed" && pendingTasks.length === 0 && attachments.length > 0 && (
        <div className="flex flex-col gap-3 p-5 rounded-xl border border-border-default bg-bg-elevated">
          <h3 className="text-sm font-semibold text-text-primary">
            Your Decision
          </h3>
          <p className="text-xs text-text-muted">
            Review the project documents above, then approve or request changes.
          </p>
          <div className="flex gap-3">
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleDecision("approved")}
              disabled={submittingDecision}
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submittingDecision ? "Submitting..." : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setChangesDialogOpen(true)}
              disabled={submittingDecision}
              className="flex-1"
            >
              <AlertTriangle className="w-4 h-4" />
              Request Changes
            </Button>
          </div>
        </div>
      )}

      {/* Request Changes Dialog */}
      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Describe what changes you&apos;d like the architect to make.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={changesComment}
            onChange={(e) => setChangesComment(e.target.value)}
            placeholder="Please describe the changes you need..."
            className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setChangesDialogOpen(false);
                setChangesComment("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await handleDecision("changes_requested", changesComment);
                setChangesDialogOpen(false);
                setChangesComment("");
              }}
              disabled={submittingDecision}
            >
              {submittingDecision ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final approval banner */}
      {project.status === "completed" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-success">
              Project Approved
            </span>
            <span className="text-xs text-text-muted">
              This project has been approved by the client.
            </span>
          </div>
        </div>
      )}

      {/* Approval history */}
      {approvals.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <History className="w-4 h-4" />
            Approval History
          </h3>
          <div className="flex flex-col gap-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-bg-elevated px-4 py-3"
              >
                {a.decision === "approved" ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                )}
                <div className="flex flex-col flex-1">
                  <span className="text-sm text-text-primary">
                    <span className="font-medium">{a.user_name}</span>{" "}
                    {a.decision === "approved"
                      ? "approved the project"
                      : "requested changes"}
                  </span>
                  {a.comment && (
                    <span className="text-xs text-text-muted">{a.comment}</span>
                  )}
                </div>
                <span className="text-[11px] text-text-muted shrink-0">
                  {new Date(a.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
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

        {/* Comment input */}
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
            placeholder="Leave a comment or feedback..."
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

        {/* Comment list */}
        {comments.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            No comments yet. Be the first to leave feedback.
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
  );
}
