"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  Maximize,
  MousePointer2,
  Highlighter,
  SquareDashed,
  Pencil,
  StickyNote,
  Eraser,
  Info,
  Pin,
  MessageSquare,
  Download,
  ExternalLink,
  Ellipsis,
  CheckCircle2,
  XCircle,
  FileText,
  X,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { deriveInitials } from "@/lib/utils";

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
  versions?: Attachment[];
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_role: string;
  created_at: string;
}

interface Phase {
  id: string;
  name: string;
  phase_order: number;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp", "gif"];

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function isImage(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(fileName));
}

function isPdf(fileName: string): boolean {
  return getFileExtension(fileName) === "pdf";
}

const ANNOTATION_TOOLS = [
  { icon: MousePointer2, label: "Select" },
  { icon: Highlighter, label: "Highlight" },
  { icon: SquareDashed, label: "Area Select" },
  { icon: Pencil, label: "Draw" },
  { icon: StickyNote, label: "Text Note" },
  { icon: Eraser, label: "Eraser" },
] as const;

/** Design review workspace with file viewer, annotation tools, and comments panel. */
export default function DesignReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id, designId } = use(params);
  const router = useRouter();
  const t = useTranslations("designReview");
  const tc = useTranslations("common");

  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<Attachment[]>([]);
  const [phaseName, setPhaseName] = useState<string>("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [activeToolIndex, setActiveToolIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reviewingAs, setReviewingAs] = useState<
    "approved" | "rejected" | null
  >(null);

  const fetchAttachment = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/attachments/${designId}`);
    if (!res.ok) return null;
    return (await res.json()) as Attachment;
  }, [id, designId]);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/comments`);
    if (!res.ok) return [];
    return (await res.json()) as Comment[];
  }, [id]);

  const fetchPhaseFiles = useCallback(
    async (phaseId: string) => {
      const res = await fetch(
        `/api/projects/${id}/attachments?phaseId=${phaseId}`
      );
      if (!res.ok) return [];
      return (await res.json()) as Attachment[];
    },
    [id]
  );

  const fetchPhaseName = useCallback(
    async (phaseId: string) => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return "";
      const data = await res.json();
      const phase = data.phases?.find((p: Phase) => p.id === phaseId);
      return phase?.name || "";
    },
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [att, cmts] = await Promise.all([
        fetchAttachment(),
        fetchComments(),
      ]);
      if (cancelled) return;
      setAttachment(att);
      setComments(cmts);

      if (att?.phase_id) {
        const [files, name] = await Promise.all([
          fetchPhaseFiles(att.phase_id),
          fetchPhaseName(att.phase_id),
        ]);
        if (cancelled) return;
        setPhaseFiles(files);
        setPhaseName(name);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchAttachment, fetchComments, fetchPhaseFiles, fetchPhaseName]);

  async function handleReview(status: "approved" | "rejected") {
    setReviewingAs(status);
    try {
      const res = await fetch(
        `/api/projects/${id}/attachments/${designId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to update review status.",
          variant: "error",
        });
        return;
      }
      toast({
        title: status === "approved" ? t("approvedToast") : t("rejectedToast"),
        description:
          status === "approved"
            ? t("approvedDescription")
            : t("rejectedDescription"),
        variant: status === "approved" ? "success" : "error",
      });
      const updated = await fetchAttachment();
      if (updated) setAttachment(updated);
    } finally {
      setReviewingAs(null);
    }
  }

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to post comment.",
          variant: "error",
        });
        return;
      }
      toast({
        title: t("commentPostedToast"),
        description: t("commentPostedDescription"),
      });
      setNewComment("");
      const updated = await fetchComments();
      setComments(updated);
    } finally {
      setSubmittingComment(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full -m-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#A0A0A0]" />
      </div>
    );
  }

  if (!attachment) {
    return (
      <div className="flex flex-col items-center justify-center h-full -m-8 gap-4">
        <FileText className="w-12 h-12 text-[#666666]" />
        <p className="text-[#A0A0A0] text-sm">Attachment not found</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to project
        </Button>
      </div>
    );
  }

  const fileName = attachment.file_name;
  const fileUrl = attachment.file_url;

  return (
    <div className="flex h-full -m-8">
      {/* 1. Thumbnail Panel */}
      <div className="w-16 shrink-0 bg-[#0D0D0D] py-4 px-2 flex flex-col items-center gap-2 overflow-y-auto">
        {phaseFiles.map((file) => {
          const isActive = file.id === designId;
          return (
            <button
              key={file.id}
              onClick={() => router.push(`/projects/${id}/review/${file.id}`)}
              className={`w-12 h-14 rounded-sm flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                isActive
                  ? "bg-[#1A1A1A] border-2 border-[#F5C518]"
                  : "bg-[#242424] border border-[#333333] hover:border-[#555555]"
              }`}
            >
              <FileText
                className={`w-5 h-5 ${
                  isActive ? "text-[#F5C518]" : "text-[#666666]"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* 2. Center Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 2a. Toolbar */}
        <div className="h-12 shrink-0 bg-[#1A1A1A] border-b border-[#333333] px-4 flex items-center justify-between gap-4">
          {/* Left: Breadcrumb */}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <button
              onClick={() => router.push(`/projects/${id}`)}
              className="text-white hover:text-[#A0A0A0] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-[#A0A0A0] shrink-0">Design</span>
            <ChevronRight className="w-3 h-3 text-[#A0A0A0] shrink-0" />
            {phaseName && (
              <>
                <span className="text-[#A0A0A0] truncate">{phaseName}</span>
                <ChevronRight className="w-3 h-3 text-[#A0A0A0] shrink-0" />
              </>
            )}
            <span className="text-white font-bold truncate">{fileName}</span>
          </div>

          {/* Right: Toolbar actions */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Page nav */}
            <div className="flex items-center gap-1">
              <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="text-[#A0A0A0] text-xs whitespace-nowrap">
                1 / 1
              </span>
              <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-[#333333]" />

            {/* Zoom */}
            <div className="flex items-center gap-1">
              <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-[#A0A0A0] text-xs">100%</span>
              <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-[#333333]" />

            {/* Maximize */}
            <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
              <Maximize className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#333333]" />

            {/* Annotation tools */}
            <div className="flex items-center bg-[#242424] rounded-md p-1 gap-0.5">
              {ANNOTATION_TOOLS.map((tool, idx) => {
                const Icon = tool.icon;
                const isActive = idx === activeToolIndex;
                return (
                  <button
                    key={tool.label}
                    onClick={() => setActiveToolIndex(idx)}
                    className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#F5C518] text-[#0D0D0D]"
                        : "text-[#A0A0A0] hover:text-white"
                    }`}
                    title={tool.label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>

            <div className="w-px h-5 bg-[#333333]" />

            {/* Utility icons */}
            <div className="flex items-center gap-2">
              <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
                <Info className="w-4 h-4" />
              </button>
              <button className="text-[#F5C518] cursor-pointer">
                <Pin className="w-4 h-4" />
              </button>
              <button
                className="text-[#A0A0A0] hover:text-white cursor-pointer"
                onClick={() => setCommentsOpen(!commentsOpen)}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <a
                href={fileUrl}
                download
                className="text-[#A0A0A0] hover:text-white"
              >
                <Download className="w-4 h-4" />
              </a>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#A0A0A0] hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button className="text-[#A0A0A0] hover:text-white cursor-pointer">
                <Ellipsis className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-[#333333]" />

            {/* Approve / Reject */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReview("approved")}
                disabled={reviewingAs !== null}
                className="flex items-center gap-1.5 border border-[#22C55E] text-[#22C55E] rounded-lg px-3.5 py-2 text-sm font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {reviewingAs === "approved" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {t("approve")}
              </button>
              <button
                onClick={() => handleReview("rejected")}
                disabled={reviewingAs !== null}
                className="flex items-center gap-1.5 border border-[#EF4444] text-[#EF4444] rounded-lg px-3.5 py-2 text-sm font-medium hover:bg-[#EF4444]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {reviewingAs === "rejected" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {t("reject")}
              </button>
            </div>
          </div>
        </div>

        {/* 2b. Document Viewer */}
        <div className="flex-1 bg-[#1A1A1A] overflow-hidden flex items-center justify-center">
          {isPdf(fileName) ? (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              title={fileName}
            />
          ) : isImage(fileName) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <FileText className="w-16 h-16 text-[#666666]" />
              <p className="text-[#A0A0A0] text-sm">Preview not available</p>
              <a
                href={fileUrl}
                download
                className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0D0D0D] rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#F5C518]/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 3. Comments Panel */}
      {commentsOpen && (
        <div className="w-[360px] shrink-0 bg-[#1A1A1A] border-l border-[#333333] flex flex-col">
          {/* Header */}
          <div className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-[#333333]">
            <span className="text-white text-base font-semibold">
              {t("comments")}
            </span>
            <button
              onClick={() => setCommentsOpen(false)}
              className="text-[#A0A0A0] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Add Comment Form */}
          <div className="p-5 flex flex-col gap-3 border-b border-[#333333]">
            <label className="text-white text-[13px] font-semibold">
              {t("addComment")}
            </label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t("commentPlaceholder")}
              className="w-full h-20 bg-[#2A2A2A] border border-[#333333] rounded-lg p-3 text-sm text-white placeholder:text-[#666666] resize-none focus:outline-none focus:border-[#F5C518]"
            />
            <button
              onClick={handlePostComment}
              disabled={submittingComment || !newComment.trim()}
              className="self-start bg-[#F5C518] text-[#0D0D0D] text-[13px] font-semibold rounded-lg py-2.5 px-6 hover:bg-[#F5C518]/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submittingComment ? "Posting..." : t("sendComment")}
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-5">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MessageCircle className="w-12 h-12 text-[#333333]" />
                <p className="text-[#666666] text-sm">No Comments to show</p>
                <p className="text-[#666666] text-xs text-center">
                  Be the first to leave feedback on this design.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex flex-col gap-2 rounded-xl bg-[#242424] p-4"
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
                        <span className="text-[11px] text-[#A0A0A0]">
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
      )}
    </div>
  );
}

function formatTimeAgo(
  timestamp: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, values?: Record<string, any>) => string
): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return t("justNow");
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  return t("daysAgo", { count: Math.floor(diffHours / 24) });
}
