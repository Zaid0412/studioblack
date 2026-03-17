"use client";

import { use, useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { DocumentViewer } from "@/components/review/DocumentViewer";
import { ThumbnailPanel } from "@/components/review/ThumbnailPanel";
import { CommentsPanel } from "@/components/review/CommentsPanel";
import type { DbAttachment, DbComment, DbPhase } from "@/types";

/**
 *
 */
export default function ClientReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id: projectId, designId } = use(params);
  const router = useRouter();
  const viewerRef = useRef<PDFViewerRef>(null);
  const t = useTranslations("clientReview");
  const tc = useTranslations("common");

  const [activeFileId, setActiveFileId] = useState(designId);
  const [attachment, setAttachment] = useState<DbAttachment | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<DbAttachment[]>([]);
  const [phaseName, setPhaseName] = useState("");
  const [filesLoading, setFilesLoading] = useState(true);
  const [comments, setComments] = useState<DbComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reviewingAs, setReviewingAs] = useState<
    "approved" | "rejected" | null
  >(null);

  const fetchAttachment = useCallback(
    async (fileId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/attachments/${fileId}`
      );
      if (!res.ok) return null;
      return (await res.json()) as DbAttachment;
    },
    [projectId]
  );

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/comments`);
    if (!res.ok) return [];
    return (await res.json()) as DbComment[];
  }, [projectId]);

  const fetchPhaseFiles = useCallback(
    async (phaseId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/attachments?phaseId=${phaseId}`
      );
      if (!res.ok) return [];
      return (await res.json()) as DbAttachment[];
    },
    [projectId]
  );

  const fetchAllFiles = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/attachments?all=true`);
    if (!res.ok) return [];
    return (await res.json()) as DbAttachment[];
  }, [projectId]);

  const fetchPhaseName = useCallback(
    async (phaseId: string) => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) return "";
      const data = await res.json();
      const phase = data.phases?.find((p: DbPhase) => p.id === phaseId);
      return phase?.name || "";
    },
    [projectId]
  );

  const isInitialLoad = useRef(true);

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
        } else {
          const files = await fetchAllFiles();
          if (cancelled) return;
          setPhaseFiles(files);
        }
        setFilesLoading(false);
      }

      if (!isFirst && activeFileId !== designId) {
        window.history.replaceState(
          null,
          "",
          `/client-dashboard/projects/${projectId}/review/${activeFileId}`
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
        `/api/projects/${projectId}/attachments/${activeFileId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: tc("error"),
          description: data.error || "Failed to update review status.",
          variant: "error",
        });
        return;
      }
      toast({
        title:
          status === "approved"
            ? t("approvedToast")
            : t("changesRequestedToast"),
        description:
          status === "approved"
            ? t("approvedDescription")
            : t("changesRequestedDescription"),
        variant: status === "approved" ? "success" : "error",
      });
      const updated = await fetchAttachment(activeFileId);
      if (updated) setAttachment(updated);
    } catch (err) {
      console.error("[handleReview]", err);
    } finally {
      setReviewingAs(null);
    }
  }

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        toast({
          title: tc("error"),
          description: "Failed to post comment.",
          variant: "error",
        });
        return;
      }
      setNewComment("");
      const updated = await fetchComments();
      setComments(updated);
    } catch (err) {
      console.error("[handlePostComment]", err);
    } finally {
      setSubmittingComment(false);
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
          onClick={() => router.push(`/client-dashboard/projects/${projectId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to project
        </Button>
      </div>
    );
  }

  const { file_name: fileName, file_url: fileUrl } = attachment;

  return (
    <div className="flex -m-8" style={{ height: "calc(100vh)" }}>
      {/* File sidebar */}
      <ThumbnailPanel
        phaseFiles={phaseFiles}
        activeFileId={activeFileId}
        phaseName={phaseName}
        loading={filesLoading}
        onSelectFile={setActiveFileId}
      />

      {/* Center area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-10 shrink-0 bg-[#1A1A1A] px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() =>
                router.push(`/client-dashboard/projects/${projectId}`)
              }
              className="text-[#A0A0A0] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Back to project"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-white text-[13px] font-medium truncate">
              {fileName}
            </span>
            {attachment.review_status &&
              attachment.review_status !== "pending" && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    attachment.review_status === "approved"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {attachment.review_status === "approved"
                    ? t("approved")
                    : t("changesRequested")}
                </span>
              )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              className="text-[#A0A0A0] hover:text-white cursor-pointer"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>

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
              {t("approved")}
            </button>
            <button
              onClick={() => handleReview("rejected")}
              disabled={reviewingAs !== null}
              className="flex items-center gap-1 border border-[#F59E0B] text-[#F59E0B] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {reviewingAs === "rejected" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {t("changesRequested")}
            </button>
          </div>
        </div>

        {/* Document viewer — view-only, no annotations */}
        <DocumentViewer
          activeFileId={activeFileId}
          fileName={fileName}
          fileUrl={fileUrl}
          viewerRef={viewerRef}
        />
      </div>

      {/* Comments panel */}
      {commentsOpen && (
        <CommentsPanel
          comments={comments}
          newComment={newComment}
          setNewComment={setNewComment}
          submittingComment={submittingComment}
          handlePostComment={handlePostComment}
          onClose={() => setCommentsOpen(false)}
        />
      )}
    </div>
  );
}
