"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Ellipsis,
  CheckCircle2,
  XCircle,
  FileText,
  X,
  MessageCircle,
  Loader2,
  Camera,
  Printer,
  Maximize,
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

/** EmbedPDF dark theme matching StudioBlack design tokens. */
const EMBEDPDF_THEME = {
  preference: "dark" as const,
  dark: {
    accent: {
      primary: "#F5C518",
      primaryHover: "#D4A912",
      primaryForeground: "#0D0D0D",
    },
    background: {
      app: "#1A1A1A",
      surface: "#242424",
      surfaceAlt: "#1A1A1A",
      elevated: "#2A2A2A",
      input: "#2A2A2A",
    },
    foreground: {
      primary: "#FFFFFF",
      secondary: "#A0A0A0",
      muted: "#666666",
    },
    border: {
      default: "#333333",
    },
  },
};

/** Hide features from EmbedPDF that we handle in our own toolbar. */
const DISABLED_CATEGORIES = [
  "document-menu",
  "document-print",
  "document-open",
  "document-close",
  "document-export",
  "document-protect",
];

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

  const [activeFileId, setActiveFileId] = useState(designId);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<Attachment[]>([]);
  const [phaseName, setPhaseName] = useState<string>("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reviewingAs, setReviewingAs] = useState<
    "approved" | "rejected" | null
  >(null);
  const viewerRef = useRef<PDFViewerRef>(null);

  // Close more menu on click outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreMenuOpen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getPlugin(name: string): Promise<any> {
    const registry = await viewerRef.current?.registry;
    if (!registry) return null;
    return registry.getPlugin(name)?.provides?.() ?? null;
  }

  async function handlePrint() {
    try {
      (await getPlugin("print"))?.print();
    } catch (err) {
      console.error("[handlePrint]", err);
    }
  }

  async function handleScreenshot() {
    try {
      const capture = await getPlugin("capture");
      if (!capture) return;
      capture.toggleMarqueeCapture();
    } catch (err) {
      console.error("[handleScreenshot]", err);
    }
  }

  async function handleFullscreen() {
    try {
      (await getPlugin("fullscreen"))?.toggleFullscreen();
    } catch (err) {
      console.error("[handleFullscreen]", err);
    }
  }

  async function handleDownload() {
    if (!attachment) return;
    try {
      const res = await fetch(
        `/api/proxy-file?url=${encodeURIComponent(attachment.file_url)}`
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  }

  const fetchAttachment = useCallback(
    async (fileId: string) => {
      const res = await fetch(`/api/projects/${id}/attachments/${fileId}`);
      if (!res.ok) return null;
      return (await res.json()) as Attachment;
    },
    [id]
  );

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

  const isInitialLoad = useRef(true);

  // Fetch attachment + sidebar data whenever activeFileId changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const isFirst = isInitialLoad.current;
      if (isFirst) {
        isInitialLoad.current = false;
        setLoading(true);
      }

      const att = await fetchAttachment(activeFileId);
      if (cancelled) return;
      setAttachment(att);

      if (isFirst) {
        const cmts = await fetchComments();
        if (cancelled) return;
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
      }

      if (!isFirst && activeFileId !== designId) {
        window.history.replaceState(
          null,
          "",
          `/projects/${id}/review/${activeFileId}`
        );
      }

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]);

  async function handleReview(status: "approved" | "rejected") {
    setReviewingAs(status);
    try {
      const res = await fetch(
        `/api/projects/${id}/attachments/${activeFileId}/review`,
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
      const updated = await fetchAttachment(activeFileId);
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
      <div
        className="flex items-center justify-center -m-8"
        style={{ height: "calc(100vh)" }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-[#F5C518]" />
      </div>
    );
  }

  if (!attachment) {
    return (
      <div
        className="flex flex-col items-center justify-center -m-8 gap-4"
        style={{ height: "calc(100vh)" }}
      >
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
    <div className="flex -m-8" style={{ height: "calc(100vh)" }}>
      {/* 1. Thumbnail Panel */}
      <div className="w-16 shrink-0 bg-[#0D0D0D] py-4 px-2 flex flex-col items-center gap-2 overflow-y-auto">
        {phaseFiles.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <button
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
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
        {/* 2a. App toolbar — blends with EmbedPDF toolbar below */}
        <div className="h-10 shrink-0 bg-[#1A1A1A] px-3 flex items-center justify-between gap-2">
          {/* Left: Back + filename */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => router.push(`/projects/${id}`)}
              className="text-[#A0A0A0] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Back to project"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-white text-[13px] font-medium truncate">
              {fileName}
            </span>
          </div>

          {/* Right: Utility + Approve/Reject */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              className={`cursor-pointer transition-colors ${commentsOpen ? "text-[#F5C518]" : "text-[#A0A0A0] hover:text-white"}`}
              onClick={async () => {
                const willOpen = !commentsOpen;
                setCommentsOpen(willOpen);
                try {
                  const plugin = await getPlugin("annotation");
                  plugin?.setActiveTool(willOpen ? "textComment" : null);
                } catch (err) {
                  console.error("[toggleComment]", err);
                }
              }}
              title="Toggle comments panel"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleScreenshot}
              className="text-[#A0A0A0] hover:text-white cursor-pointer"
              title="Screenshot"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="text-[#A0A0A0] hover:text-white cursor-pointer"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* More options dropdown */}
            <div className="relative" ref={moreMenuRef}>
              <button
                className="text-[#A0A0A0] hover:text-white cursor-pointer"
                title="More options"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              >
                <Ellipsis className="w-4 h-4" />
              </button>
              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#242424] border border-[#333333] rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={() => {
                      handlePrint();
                      setMoreMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => {
                      handleFullscreen();
                      setMoreMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
                  >
                    <Maximize className="w-4 h-4" />
                    Fullscreen
                  </button>
                  <a
                    href={`/api/proxy-file?url=${encodeURIComponent(fileUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in new tab
                  </a>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[#333333]" />

            <button
              onClick={() => handleReview("approved")}
              disabled={reviewingAs !== null}
              className="flex items-center gap-1 border border-[#22C55E] text-[#22C55E] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {reviewingAs === "approved" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {t("approve")}
            </button>
            <button
              onClick={() => handleReview("rejected")}
              disabled={reviewingAs !== null}
              className="flex items-center gap-1 border border-[#EF4444] text-[#EF4444] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#EF4444]/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {reviewingAs === "rejected" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              {t("reject")}
            </button>
          </div>
        </div>

        {/* 2b. Document Viewer */}
        <div
          className={`flex-1 min-h-0 bg-[#1A1A1A] overflow-hidden ${isPdf(fileName) ? "relative" : "flex items-center justify-center"}`}
        >
          {isPdf(fileName) ? (
            <div className="absolute inset-0">
              <PDFViewer
                key={activeFileId}
                ref={viewerRef}
                style={{ width: "100%", height: "100%" }}
                config={{
                  src: `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`,
                  wasmUrl: "/pdfium.wasm",
                  worker: false,
                  theme: EMBEDPDF_THEME,
                  tabBar: "never",
                  disabledCategories: DISABLED_CATEGORIES,
                  annotations: {
                    annotationAuthor: "StudioBlack User",
                    autoCommit: true,
                    selectAfterCreate: true,
                  },
                  permissions: {
                    enforceDocumentPermissions: false,
                    overrides: {
                      print: true,
                      copyContents: true,
                      modifyAnnotations: true,
                    },
                  },
                }}
              />
            </div>
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
