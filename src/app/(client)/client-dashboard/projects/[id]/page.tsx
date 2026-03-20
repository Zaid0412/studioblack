"use client";

import { use } from "react";
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
  Lock,
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
import { useClientProjectDetail } from "./_hooks/useClientProjectDetail";

/** Client-facing project detail page with phases, files, and members. */
export default function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const tc = useTranslations("common");

  const {
    project,
    loading,
    error,
    comments,
    approvals,
    pendingTasks,
    activePhaseId,
    setActivePhaseId,
    phaseCounts,
    phaseFiles,
    newComment,
    setNewComment,
    sendingComment,
    handleSendComment,
    submittingDecision,
    handleDecision,
    changesDialogOpen,
    setChangesDialogOpen,
    changesComment,
    setChangesComment,
    reviewingTaskId,
    handleTaskReview,
    attachments,
  } = useClientProjectDetail(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-[#666666]">{tc("projectNotFound")}</p>
      </div>
    );
  }

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.description && (
              <p className="text-[13px] text-[#A0A0A0] mt-1">
                {project.description}
              </p>
            )}
          </div>
          {project.status !== "completed" &&
            pendingTasks.length === 0 &&
            attachments.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setChangesDialogOpen(true)}
                  disabled={submittingDecision}
                  className="flex items-center gap-1.5 border border-[#F59E0B] text-[#F59E0B] rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("requestChanges")}
                </button>
                <button
                  onClick={() => handleDecision("approved")}
                  disabled={submittingDecision}
                  className="flex items-center gap-1.5 bg-[#22C55E] text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:bg-[#22C55E]/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {submittingDecision ? t("submitting") : t("approveProject")}
                </button>
              </div>
            )}
        </div>
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
                <Avatar
                  key={m.user_id}
                  initials={deriveInitials(m.name)}
                  color={avatarColor(m.user_id)}
                  size="sm"
                  className="w-6 h-6 text-[9px] border border-[#1A1A1A]"
                />
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
              {t("tasksPendingReview")} ({pendingTasks.length})
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
                    {t("phase")}: {task.phase_name}
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
                    {t("approve")}
                  </button>
                  <button
                    onClick={() =>
                      handleTaskReview(task.id, "changes_requested")
                    }
                    disabled={reviewingTaskId === task.id}
                    className="flex items-center gap-1 border border-[#F59E0B] text-[#F59E0B] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t("changes")}
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
              {t("projectApproved")}
            </span>
            <span className="text-[11px] text-[#666666]">
              — {t("projectApprovedHint")}
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
                title={t("noFilesYet")}
                description={t("noFilesDescription")}
              />
            ) : (
              phaseFiles.map((att) => {
                const badge = statusBadge(att.review_status);
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
                      <div className="relative shrink-0">
                        <FileText className="w-4 h-4 text-[#A0A0A0]" />
                        <span className="absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full bg-[#2A1F00] min-w-[18px] h-[14px] px-1 text-[8px] font-bold text-[#F5C518] leading-none">
                          V{att.version || 1}
                        </span>
                      </div>
                      {att.frozen_at && (
                        <Lock className="w-3 h-3 text-[#F5C518] shrink-0" />
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
                      <Avatar
                        initials={deriveInitials(att.uploaded_by_name || "")}
                        color={avatarColor(att.uploaded_by || "")}
                        size="sm"
                        className="w-6 h-6 text-[10px]"
                      />
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

      {/* Request Changes Dialog */}
      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requestChangesTitle")}</DialogTitle>
            <DialogDescription>{t("requestChangesHint")}</DialogDescription>
          </DialogHeader>
          <textarea
            value={changesComment}
            onChange={(e) => setChangesComment(e.target.value)}
            placeholder={t("requestChangesPlaceholder")}
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
              {tc("cancel")}
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
              {submittingDecision ? t("submitting") : t("submit")}
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
              {t("approvalHistory")}
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
                      ? t("approvedProject")
                      : t("requestedChanges")}
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
            {t("comments", { count: comments.length })}
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
            placeholder={t("commentPlaceholder")}
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
            {t("noCommentsYet")}
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
                    color={avatarColor(comment.user_id)}
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
