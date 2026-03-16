"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Upload,
  Edit,
  Loader2,
  FileText,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { FileContextMenu } from "@/components/ui/file-context-menu";
import { WorkflowSteps } from "@/components/project/workflow-steps";
import { deriveInitials } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Phase {
  id: string;
  name: string;
  phase_order: number;
  status: string;
}

interface Step {
  id: string;
  name: string;
  step_order: number;
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
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  version?: number;
  version_group?: string;
  review_status?: string;
  reviewed_by_name?: string | null;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_role: string;
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
  steps?: Step[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** File extension → display type. */
function fileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "PDF",
    dwg: "DWG",
    dxf: "DXF",
    png: "PNG",
    jpg: "JPEG",
    jpeg: "JPEG",
    svg: "SVG",
    psd: "PSD",
    ai: "AI",
  };
  return map[ext] || ext.toUpperCase() || "FILE";
}

/** Review status → badge colors. */
function statusBadge(status: string | undefined) {
  switch (status) {
    case "approved":
      return { bg: "bg-[#0A2E14]", text: "text-[#22C55E]", label: "Approved" };
    case "rejected":
      return { bg: "bg-[#2E0A0A]", text: "text-[#EF4444]", label: "Rejected" };
    case "reviewed":
      return { bg: "bg-[#242424]", text: "text-[#A0A0A0]", label: "Reviewed" };
    case "pending":
    default:
      return { bg: "bg-[#242424]", text: "text-[#666666]", label: "Draft" };
  }
}

/** Get random-ish avatar color from a string. */
const avatarColors = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];
function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Project detail page — workflow steps, phase tabs, file table. */
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
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  // Fetch project data
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
    ])
      .then(([projectData, attachData, commentData]) => {
        setProject(projectData);
        setAttachments(attachData);
        setComments(commentData);
        // Default to first phase
        if (projectData.phases?.length > 0) {
          setActivePhaseId(projectData.phases[0].id);
        }
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

  const handleDownload = (att: Attachment) => {
    window.open(att.file_url, "_blank");
  };

  // Loading / error states
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

  const client = project.client_name || project.client_email || "\u2014";
  const architects =
    project.members
      .filter((m) => m.role === "architect")
      .map((m) => m.name)
      .join(", ") || "\u2014";
  const createdDate = new Date(project.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const phaseFiles = attachments.filter((a) => a.phase_id === activePhaseId);
  const phaseCounts = new Map<string, number>();
  for (const a of attachments) {
    if (a.phase_id)
      phaseCounts.set(a.phase_id, (phaseCounts.get(a.phase_id) || 0) + 1);
  }
  const designSectionCount = project.phases.filter(
    (p) => (phaseCounts.get(p.id) || 0) > 0
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-10 py-5 border-b border-[#333333]">
        <span className="text-[13px] text-[#666666]">
          <button
            onClick={() => router.push("/projects")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            {t("breadcrumbProjects") || "Projects"}
          </button>
          {" / "}
          {project.name}
        </span>
        <h1 className="text-[26px] font-bold text-white font-[family-name:var(--font-cabinet)] mt-1">
          {project.name}
        </h1>
      </div>

      {/* ── Meta Bar ── */}
      <div className="px-10 py-3">
        <div className="flex items-center gap-8 rounded-[10px] bg-[#1A1A1A] border border-[#333333] px-5 py-4">
          {/* Client */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
              {t("clientLabel").replace(":", "")}
            </span>
            <span className="text-[14px] font-medium text-white">{client}</span>
          </div>
          <div className="w-px h-8 bg-[#333333]" />
          {/* Architects */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
              {t("architects") || "Architects"}
            </span>
            <span className="text-[14px] font-medium text-white">
              {architects}
            </span>
          </div>
          <div className="w-px h-8 bg-[#333333]" />
          {/* Created */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
              {t("created") || "Created"}
            </span>
            <span className="text-[14px] font-medium text-white">
              {createdDate}
            </span>
          </div>
          <div className="w-px h-8 bg-[#333333]" />
          {/* Sections count */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
              {t("sections") || "Sections"}
            </span>
            <span className="text-[14px] font-medium text-white">
              {designSectionCount} {t("designSections")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Workflow Steps Bar ── */}
      <div className="flex items-center justify-between px-10 py-4 border-b border-[#333333]">
        {project.steps && project.steps.length > 0 ? (
          <WorkflowSteps steps={project.steps} />
        ) : (
          <WorkflowSteps
            steps={[
              { id: "1", name: "Recce", step_order: 1, status: "completed" },
              { id: "2", name: "Design", step_order: 2, status: "in_progress" },
              { id: "3", name: "BOQ", step_order: 3, status: "pending" },
              { id: "4", name: "Order", step_order: 4, status: "pending" },
              {
                id: "5",
                name: "Work Progress",
                step_order: 5,
                status: "pending",
              },
              { id: "6", name: "Snag", step_order: 6, status: "pending" },
              { id: "7", name: "Finance", step_order: 7, status: "pending" },
            ]}
          />
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="!text-xs"
            onClick={() => router.push(`/projects/${id}/edit`)}
          >
            <Edit className="w-3.5 h-3.5" />
            {t("designReview") || "Design Review"}
          </Button>
          <Button
            className="!text-xs !bg-[#EF4444] !text-white hover:!bg-[#DC2626]"
            onClick={() => router.push(`/projects/${id}/upload`)}
          >
            {t("actionsButton") || "Actions"}
          </Button>
        </div>
      </div>

      {/* ── Phase Tabs ── */}
      <div className="flex items-center px-10 border-b border-[#333333] overflow-x-auto shrink-0">
        {project.phases.map((phase) => {
          const isActive = phase.id === activePhaseId;
          const count = phaseCounts.get(phase.id) || 0;
          return (
            <button
              key={phase.id}
              onClick={() => setActivePhaseId(phase.id)}
              className={`relative flex items-center gap-1.5 px-4 h-11 text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? "text-white font-medium"
                  : "text-[#A0A0A0] font-normal hover:text-white"
              }`}
            >
              {phase.name}
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] ${
                  isActive
                    ? "bg-[#333333] text-white font-medium"
                    : "bg-[#242424] text-[#666666] font-normal"
                }`}
              >
                {count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F5C518]" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── File Table ── */}
      <div className="flex-1 px-10 py-4">
        <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-[400px]">
          {/* Table header */}
          <div className="flex items-center h-11 px-5 bg-[#242424] border-b border-[#333333]">
            <div className="w-10 flex items-center justify-center">
              <div className="w-4 h-4 rounded-[2px] border border-[#444444]" />
            </div>
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
            <div className="w-[100px] text-xs font-medium text-[#A0A0A0]">
              {t("statusLabel").replace(":", "") || "Status"}
            </div>
            <div className="w-[50px]" />
          </div>

          {/* Table body */}
          <div className="flex-1">
            {phaseFiles.length === 0 ? (
              <EmptyState
                icon={Upload}
                title={te("designSectionsTitle")}
                description={te("designSectionsDescription")}
                action={{
                  label: te("designSectionsAction"),
                  href: `/projects/${id}/upload${activePhaseId ? `?phaseId=${activePhaseId}` : ""}`,
                }}
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
                      router.push(`/projects/${id}/review/${att.id}`)
                    }
                  >
                    {/* Checkbox */}
                    <div
                      className="w-10 flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-4 h-4 rounded-[2px] border border-[#444444]" />
                    </div>

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
                    <div className="w-[100px]">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div
                      className="w-[50px] flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileContextMenu
                        onDownload={() => handleDownload(att)}
                        onEdit={() =>
                          router.push(`/projects/${id}/review/${att.id}`)
                        }
                        onUploadNewVersion={() =>
                          router.push(
                            `/projects/${id}/upload?phaseId=${att.phase_id}&versionGroup=${att.version_group}`
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Comments Section ── */}
      <div className="px-10 pb-8">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
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
              className="flex-1 rounded-lg border border-[#333333] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white placeholder:text-[#666666] resize-none focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518]/30"
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
            <p className="text-sm text-[#666666] py-4 text-center">
              No comments yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex flex-col gap-2 rounded-xl bg-[#1A1A1A] p-4"
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
                        {new Date(comment.created_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
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
    </div>
  );
}
