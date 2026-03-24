"use client";

import { use, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { ArrowLeft, FileText, Loader2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignReview } from "@/hooks/useDesignReview";
import { useCommentTool } from "@/hooks/useCommentTool";
import { usePdfPlugins } from "@/hooks/usePdfPlugins";
import { useAnnotationTracker } from "@/hooks/useAnnotationTracker";
import { useUserRole } from "@/hooks/useUserRole";
import { ThumbnailPanel } from "@/components/review/ThumbnailPanel";
import { ReviewToolbar } from "@/components/review/ReviewToolbar";
import { DocumentViewer } from "@/components/review/DocumentViewer";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { ReviewSubmitBar } from "@/components/review/ReviewSubmitBar";
import { UploadDialog } from "@/components/ui/UploadDialog";
import { toast } from "@/components/ui/useToast";
import { attachments as attachmentsApi, upload, ApiError } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { displayName, isPdf } from "@/lib/fileUtils";

/** Unified design review workspace — adapts to PM/architect or client role. */
export default function DesignReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id, designId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewerRef = useRef<PDFViewerRef>(null);
  const t = useTranslations("clientReview");
  const tc = useTranslations("common");

  const { role } = useUserRole();
  const isClient = role === "client";
  const { data: session } = authClient.useSession();

  const review = useDesignReview({
    projectId: id,
    designId,
    basePath: "/projects",
    fetchReviews: !isClient,
  });
  const {
    activeFileId,
    setActiveFileId,
    attachment,
    setAttachment,
    fetchAttachment,
  } = review;
  const plugins = usePdfPlugins({ viewerRef, attachment });
  const { commentToolActive, toggleCommentTool } = useCommentTool({
    viewerRef,
  });
  const annotations = useAnnotationTracker({
    viewerRef,
    enabled:
      isClient &&
      !review.loading &&
      !!attachment &&
      isPdf(attachment.file_name),
  });

  const [reviewsOpen, setReviewsOpen] = useState(
    searchParams.get("reviews") === "open"
  );
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleUploadSuccess = useCallback(async () => {
    const updated = await fetchAttachment(activeFileId);
    if (updated) setAttachment(updated);
  }, [fetchAttachment, activeFileId, setAttachment]);

  const handleToggleFreeze = useCallback(async () => {
    if (!attachment) return;
    try {
      if (attachment.frozen_at) {
        await attachmentsApi.unfreeze(id, attachment.id);
        toast({
          title: "File unfrozen",
          description: `"${attachment.file_name}" can now be edited.`,
          variant: "success",
        });
      } else {
        await attachmentsApi.freeze(id, attachment.id);
        toast({
          title: "File frozen",
          description: `"${attachment.file_name}" is now locked.`,
          variant: "success",
        });
      }
      const updated = await fetchAttachment(activeFileId);
      if (updated) setAttachment(updated);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update freeze status.",
        variant: "error",
      });
    }
  }, [id, attachment, fetchAttachment, activeFileId, setAttachment]);

  // Client: submit a review with optional annotated PDF
  async function handleSubmitReview(
    status: "approved" | "rejected",
    comment: string
  ) {
    let annotatedFileUrl: string | null = null;

    if (annotations.hasChanges && isPdf(attachment?.file_name || "")) {
      const buffer = await annotations.exportAnnotatedPdf();
      if (buffer && buffer.byteLength > 0) {
        const blob = new Blob([buffer], { type: "application/pdf" });
        const baseName = attachment!.file_name.replace(/\.pdf$/i, "");
        const reviewFileName = `${baseName}_review.pdf`;
        const file = new File([blob], reviewFileName, {
          type: "application/pdf",
        });

        try {
          const { url } = await upload.uploadFile(file);
          annotatedFileUrl = url;
        } catch {
          toast({
            title: tc("error"),
            description: "Failed to upload annotated PDF.",
            variant: "error",
          });
          return;
        }
      }
    }

    try {
      await attachmentsApi.submitReview(id, activeFileId, {
        status,
        comment,
        annotatedFileUrl: annotatedFileUrl ?? undefined,
        annotationCount: annotations.annotationCount,
      });
    } catch (err) {
      toast({
        title: tc("error"),
        description:
          err instanceof ApiError ? err.message : "Failed to submit review.",
        variant: "error",
      });
      return;
    }

    toast({
      title:
        status === "approved" ? t("approvedToast") : t("changesRequestedToast"),
      description:
        status === "approved"
          ? t("approvedDescription")
          : t("changesRequestedDescription"),
      variant: status === "approved" ? "success" : "error",
    });

    annotations.reset();
    const updated = await fetchAttachment(activeFileId);
    if (updated) setAttachment(updated);
  }

  if (review.loading) {
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

  const { file_name: fileName, file_url: fileUrl } = attachment;

  return (
    <div className="flex -m-8" style={{ height: "calc(100vh)" }}>
      <ThumbnailPanel
        phaseFiles={review.phaseFiles}
        activeFileId={activeFileId}
        phaseName={review.phaseName}
        loading={review.filesLoading}
        onSelectFile={setActiveFileId}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <ReviewToolbar
          backPath={`/projects/${id}`}
          fileName={fileName}
          fileUrl={fileUrl}
          commentToolActive={commentToolActive}
          onToggleCommentTool={toggleCommentTool}
          onScreenshot={plugins.handleScreenshot}
          onDownload={plugins.handleDownload}
          onPrint={plugins.handlePrint}
          onFullscreen={plugins.handleFullscreen}
          onUploadNewVersion={
            !isClient && attachment?.version_group && !attachment?.frozen_at
              ? () => setUploadOpen(true)
              : undefined
          }
          frozen={!isClient ? !!attachment?.frozen_at : undefined}
          onToggleFreeze={!isClient ? handleToggleFreeze : undefined}
          leftSlot={
            isClient &&
            attachment.review_status &&
            attachment.review_status !== "pending" ? (
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
            ) : undefined
          }
          rightSlot={
            !isClient ? (
              <button
                onClick={() => setReviewsOpen(!reviewsOpen)}
                className={`cursor-pointer transition-colors flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
                  reviewsOpen
                    ? "bg-[#F5C518]/15 text-[#F5C518]"
                    : review.reviews.length > 0
                      ? "bg-[#242424] text-[#A0A0A0] hover:text-white"
                      : "text-[#A0A0A0] hover:text-white"
                }`}
                title="Reviews"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                {review.reviews.length > 0 && (
                  <span>{review.reviews.length}</span>
                )}
              </button>
            ) : undefined
          }
        />

        <DocumentViewer
          activeFileId={activeFileId}
          fileName={fileName}
          fileUrl={fileUrl}
          viewerRef={viewerRef}
          annotations
          annotationAuthor={displayName(
            session?.user?.name,
            isClient ? "Client" : undefined
          )}
        />

        {/* PM: Reviews Panel (overlay) */}
        {!isClient && reviewsOpen && (
          <ReviewPanel
            reviews={review.reviews}
            onClose={() => setReviewsOpen(false)}
          />
        )}

        {/* Client: Review Submit Bar */}
        {isClient && (
          <ReviewSubmitBar
            annotationCount={annotations.annotationCount}
            hasChanges={annotations.hasChanges}
            onSubmit={handleSubmitReview}
          />
        )}
      </div>

      {/* PM: Upload New Version Dialog */}
      {!isClient && attachment?.version_group && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          projectId={id}
          phaseId={attachment.phase_id}
          versionGroup={attachment.version_group}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
