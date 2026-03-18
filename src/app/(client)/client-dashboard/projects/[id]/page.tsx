"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Paperclip,
  MessageSquare,
  Send,
  AlertTriangle,
  History,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deriveInitials } from "@/lib/utils";
import { fileType, statusBadge } from "@/lib/fileUtils";
import { avatarColor } from "@/lib/avatarUtils";
import { formatTimeAgo } from "@/lib/formatTime";

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
  review_status?: string;
  version?: number;
  version_group?: string;
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

/**
 *
 */
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
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      }),
      fetch(`/api/projects/${id}/attachments?all=true`).then((res) =>
        res.ok ? res.json() : []
      ),
      fetch(`/api/projects/${id}/comments`).then((res) =>
        res.ok ? res.json() : []
      ),
      fetch(`/api/projects/${id}/approvals`).then((res) =>
        res.ok ? res.json() : []
      ),
      fetch(`/api/projects/${id}/tasks/pending-review`).then((res) =>
        res.ok ? res.json() : []
      ),
    ])
      .then(
        ([
          projectData,
          attachmentData,
          commentData,
          approvalData,
          pendingTaskData,
        ]) => {
          setProject(projectData);
          setAttachments(attachmentData);
          setComments(commentData);
          setApprovals(approvalData);
          setPendingTasks(pendingTaskData);
          if (projectData.phases?.length > 0) {
            setActivePhaseId(projectData.phases[0].id);
          }
        }
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendComment = useCallback(async () => {
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
  }, [id, newComment, sendingComment]);

  const handleDecision = async (
    decision: "approved" | "changes_requested",
    comment?: string
  ) => {
    if (submittingDecision) return;
    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/projects/${id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || "" }),
      });
      if (res.ok) {
        const [updatedApprovals, updatedProject] = await Promise.all([
          fetch(`/api/projects/${id}/approvals`).then((r) =>
            r.ok ? r.json() : []
          ),
          fetch(`/api/projects/${id}`).then((r) => (r.ok ? r.json() : null)),
        ]);
        setApprovals(updatedApprovals);
        if (updatedProject) setProject(updatedProject);
      }
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleTaskReview = async (
    taskId: string,
    action: "approved" | "changes_requested",
    comment?: string
  ) => {
    setReviewingTaskId(taskId);
    try {
      const res = await fetch(`/api/projects/${id}/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || "" }),
      });
      if (res.ok) {
        setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } finally {
      setReviewingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#666666]">{tc("projectNotFound")}</p>
      </div>
    );
  }

  // Count attachments per phase
  const phaseCounts = new Map<string, number>();
  for (const a of attachments) {
    if (a.phase_id)
      phaseCounts.set(a.phase_id, (phaseCounts.get(a.phase_id) || 0) + 1);
  }
  const phaseFiles = attachments.filter((a) => a.phase_id === activePhaseId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-10 pt-6 pb-4">
        <button
          onClick={() => router.push("/client-dashboard/projects")}
          className="flex items-center gap-2 text-[13px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {tc("backToProjects")}
        </button>
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        {project.description && (
          <p className="text-[13px] text-[#A0A0A0] mt-1">
            {project.description}
          </p>
        )}
      </div>

      {/* Meta bar */}
      <div className="px-10 py-3 flex items-center gap-6 text-[13px] border-b border-[#333333]">
        <div className="flex items-center gap-2">
          <span className="text-[#666666]">{t("statusLabel")}</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              project.status === "active"
                ? "bg-emerald-500/20 text-emerald-400"
                : project.status === "completed"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-[#333333] text-[#A0A0A0]"
            }`}
          >
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#A0A0A0]">
          <span className="text-[#666666]">Category:</span>
          <span className="capitalize">{project.category}</span>
        </div>
        {project.deadline && (
          <div className="flex items-center gap-1.5 text-[#A0A0A0]">
            <Calendar className="w-3.5 h-3.5 text-[#F5C518]" />
            {t("duePrefix")}{" "}
            {new Date(project.deadline).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
        {project.members.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Users className="w-3.5 h-3.5 text-[#666666]" />
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 4).map((m) => (
                <div
                  key={m.user_id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium text-white border border-[#1A1A1A]"
                  style={{ backgroundColor: avatarColor(m.name) }}
                  title={`${m.name} (${m.role})`}
                >
                  {deriveInitials(m.name)}
                </div>
              ))}
              {project.members.length > 4 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium text-[#A0A0A0] bg-[#333333] border border-[#1A1A1A]">
                  +{project.members.length - 4}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pending task reviews banner */}
      {pendingTasks.length > 0 && (
        <div className="px-10 py-3 bg-[#1A1600] border-b border-[#333333]">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-[#F5C518]" />
            <span className="text-[13px] font-semibold text-white">
              Tasks Pending Your Review ({pendingTasks.length})
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg bg-[#0D0D0D] px-4 py-3"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-white">
                    {task.title}
                  </span>
                  <span className="text-[11px] text-[#666666]">
                    Phase: {task.phase_name}
                    {task.assigned_name && ` · By ${task.assigned_name}`}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleTaskReview(task.id, "approved")}
                    disabled={reviewingTaskId === task.id}
                    className="flex items-center gap-1 border border-[#22C55E] text-[#22C55E] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      handleTaskReview(task.id, "changes_requested")
                    }
                    disabled={reviewingTaskId === task.id}
                    className="flex items-center gap-1 border border-[#F59E0B] text-[#F59E0B] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Changes
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed banner */}
      {project.status === "completed" && (
        <div className="px-10 py-3 bg-emerald-500/5 border-b border-[#333333]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[13px] font-medium text-emerald-400">
              Project Approved
            </span>
            <span className="text-[11px] text-[#666666]">
              — This project has been approved by the client.
            </span>
          </div>
        </div>
      )}

      {/* Phase tabs */}
      {project.phases.length > 0 && (
        <div className="px-10 flex items-center gap-1 border-b border-[#333333]">
          {project.phases.map((phase) => {
            const isActive = phase.id === activePhaseId;
            const count = phaseCounts.get(phase.id) || 0;
            return (
              <button
                key={phase.id}
                onClick={() => setActivePhaseId(phase.id)}
                className={`relative px-4 py-3 text-[13px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "text-[#F5C518]"
                    : "text-[#A0A0A0] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  {phase.status === "completed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : phase.status === "in_progress" ? (
                    <Clock className="w-3.5 h-3.5 text-[#F5C518]" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-[#666666]" />
                  )}
                  {phase.name}
                  {count > 0 && (
                    <span className="text-[11px] text-[#666666]">{count}</span>
                  )}
                </div>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F5C518]" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* File table */}
      <div className="flex-1 px-10 py-4">
        <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-[300px]">
          {/* Table header */}
          <div className="flex items-center h-11 px-5 bg-[#242424] border-b border-[#333333]">
            <div className="flex-1 text-xs font-medium text-[#A0A0A0]">
              {t("fileName") || "Name of File"}
            </div>
            <div className="w-[120px] text-xs font-medium text-[#A0A0A0]">
              {t("fileType") || "Type of File"}
            </div>
            <div className="w-[140px] text-xs font-medium text-[#A0A0A0]">
              {t("uploadedBy") || "Uploaded by"}
            </div>
            <div className="w-[110px] text-xs font-medium text-[#A0A0A0]">
              {t("uploadedOn") || "Uploaded On"}
            </div>
            <div className="w-[140px] text-xs font-medium text-[#A0A0A0]">
              {t("statusLabel").replace(":", "") || "Status"}
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1">
            {phaseFiles.length === 0 ? (
              <EmptyState
                icon={Paperclip}
                title="No files yet"
                description="No documents have been uploaded for this phase yet."
              />
            ) : (
              phaseFiles.map((att) => {
                const badge = statusBadge(att.review_status);
                const color = avatarColor(att.uploaded_by_name || "");
                return (
                  <div
                    key={att.id}
                    className="flex items-center h-[52px] px-5 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/client-dashboard/projects/${id}/review/${att.id}`
                      )
                    }
                  >
                    {/* File name */}
                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#A0A0A0] shrink-0" />
                      {att.version && att.version > 1 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-[#2A1F00] px-1.5 py-0.5 text-[10px] font-medium text-[#F5C518]">
                          V{att.version}
                        </span>
                      )}
                      <span className="text-[13px] font-medium text-white truncate">
                        {att.file_name}
                      </span>
                    </div>

                    {/* Type */}
                    <div className="w-[120px]">
                      <span className="text-[13px] text-[#A0A0A0]">
                        {fileType(att.file_name)}
                      </span>
                    </div>

                    {/* Uploaded by */}
                    <div className="w-[140px] flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {deriveInitials(att.uploaded_by_name || "")}
                      </div>
                      <span className="text-[13px] text-[#A0A0A0] truncate">
                        {att.uploaded_by_name || "\u2014"}
                      </span>
                    </div>

                    {/* Uploaded on */}
                    <div className="w-[110px]">
                      <span className="text-[12px] text-[#666666]">
                        {new Date(att.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="w-[140px]">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Approval decision — only when active + has files + no pending tasks */}
      {project.status !== "completed" &&
        pendingTasks.length === 0 &&
        attachments.length > 0 && (
          <div className="px-10 pb-4">
            <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] p-5">
              <h3 className="text-[13px] font-semibold text-white mb-1">
                Your Decision
              </h3>
              <p className="text-[11px] text-[#666666] mb-4">
                Review the project documents above, then approve or request
                changes.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDecision("approved")}
                  disabled={submittingDecision}
                  className="flex items-center justify-center gap-2 flex-1 border border-[#22C55E] text-[#22C55E] rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submittingDecision ? "Submitting..." : "Approve Project"}
                </button>
                <button
                  onClick={() => setChangesDialogOpen(true)}
                  disabled={submittingDecision}
                  className="flex items-center justify-center gap-2 flex-1 border border-[#F59E0B] text-[#F59E0B] rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Request Changes
                </button>
              </div>
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
            className="w-full rounded-lg border border-[#333333] bg-[#2A2A2A] px-3 py-2.5 text-sm text-white placeholder:text-[#666666] resize-none focus:outline-none focus:border-[#F5C518]"
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => {
                setChangesDialogOpen(false);
                setChangesComment("");
              }}
              className="px-4 py-2 text-[13px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await handleDecision("changes_requested", changesComment);
                setChangesDialogOpen(false);
                setChangesComment("");
              }}
              disabled={submittingDecision}
              className="bg-[#F5C518] text-[#0D0D0D] rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-[#F5C518]/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submittingDecision ? "Submitting..." : "Submit"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval history */}
      {approvals.length > 0 && (
        <div className="px-10 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-[#666666]" />
            <span className="text-[13px] font-semibold text-white">
              Approval History
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-[#1A1A1A] border border-[#333333] px-4 py-3"
              >
                {a.decision === "approved" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                )}
                <div className="flex flex-col flex-1">
                  <span className="text-[13px] text-[#A0A0A0]">
                    <span className="font-medium text-white">
                      {a.user_name}
                    </span>{" "}
                    {a.decision === "approved"
                      ? "approved the project"
                      : "requested changes"}
                  </span>
                  {a.comment && (
                    <span className="text-[11px] text-[#666666]">
                      {a.comment}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#666666] shrink-0">
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
      <div className="px-10 pb-6">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-[#666666]" />
          <span className="text-[13px] font-semibold text-white">
            Comments ({comments.length})
          </span>
        </div>

        {/* Comment input */}
        <div className="flex gap-3 mb-4">
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
            className="flex-1 rounded-lg border border-[#333333] bg-[#2A2A2A] px-3 py-2.5 text-sm text-white placeholder:text-[#666666] resize-none focus:outline-none focus:border-[#F5C518]"
            rows={2}
          />
          <button
            onClick={handleSendComment}
            disabled={!newComment.trim() || sendingComment}
            className="self-end bg-[#F5C518] text-[#0D0D0D] rounded-lg p-2.5 hover:bg-[#F5C518]/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {sendingComment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Comment list */}
        {comments.length === 0 ? (
          <p className="text-[13px] text-[#666666] py-4 text-center">
            No comments yet. Be the first to leave feedback.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex flex-col gap-2 rounded-xl bg-[#1A1A1A] border border-[#333333] p-4"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar
                    initials={deriveInitials(comment.user_name)}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-white">
                      {comment.user_name}
                    </span>
                    <span className="text-[11px] text-[#666666]">
                      {formatTimeAgo(comment.created_at, tc)}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-[#A0A0A0] leading-relaxed">
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
