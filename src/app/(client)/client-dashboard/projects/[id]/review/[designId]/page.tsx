"use client";

import { use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import { DocumentViewer } from "@/components/review/DocumentViewer";
import { ThumbnailPanel } from "@/components/review/ThumbnailPanel";
import { ReviewSubmitBar } from "@/components/review/ReviewSubmitBar";
import { ReviewToolbar } from "@/components/review/ReviewToolbar";
import { useDesignReview } from "@/hooks/useDesignReview";
import { useCommentTool } from "@/hooks/useCommentTool";
import { useAnnotationTracker } from "@/hooks/useAnnotationTracker";
import { usePdfPlugins } from "@/hooks/usePdfPlugins";
import { isPdf, displayName } from "@/lib/fileUtils";

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
  const { data: session } = authClient.useSession();

  const review = useDesignReview({
    projectId,
    designId,
    basePath: "/client-dashboard/projects",
  });
  const plugins = usePdfPlugins({ viewerRef, attachment: review.attachment });
  const { commentToolActive, toggleCommentTool } = useCommentTool({
    viewerRef,
  });
  const annotations = useAnnotationTracker({
    viewerRef,
    enabled:
      !review.loading &&
      !!review.attachment &&
      isPdf(review.attachment.file_name),
  });

  async function handleSubmitReview(
    status: "approved" | "rejected",
    comment: string
  ) {
    let annotatedFileUrl: string | null = null;

    if (annotations.hasChanges && isPdf(review.attachment?.file_name || "")) {
      const buffer = await annotations.exportAnnotatedPdf();
      if (buffer && buffer.byteLength > 0) {
        const blob = new Blob([buffer], { type: "application/pdf" });
        const baseName = review.attachment!.file_name.replace(/\.pdf$/i, "");
        const reviewFileName = `${baseName}_review.pdf`;

        const formData = new FormData();
        formData.append("file", blob, reviewFileName);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          annotatedFileUrl = url;
        } else {
          toast({
            title: tc("error"),
            description: "Failed to upload annotated PDF.",
            variant: "error",
          });
          return;
        }
      }
    }

    const res = await fetch(
      `/api/projects/${projectId}/attachments/${review.activeFileId}/review`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          comment,
          annotatedFileUrl,
          annotationCount: annotations.annotationCount,
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        title: tc("error"),
        description: data.error || "Failed to submit review.",
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
    const updated = await review.fetchAttachment(review.activeFileId);
    if (updated) review.setAttachment(updated);
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

  if (!review.attachment) {
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

  const { file_name: fileName, file_url: fileUrl } = review.attachment;

  return (
    <div className="flex -m-8" style={{ height: "calc(100vh)" }}>
      <ThumbnailPanel
        phaseFiles={review.phaseFiles}
        activeFileId={review.activeFileId}
        phaseName={review.phaseName}
        loading={review.filesLoading}
        onSelectFile={review.setActiveFileId}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <ReviewToolbar
          backPath={`/client-dashboard/projects/${projectId}`}
          fileName={fileName}
          fileUrl={fileUrl}
          commentToolActive={commentToolActive}
          onToggleCommentTool={toggleCommentTool}
          onScreenshot={plugins.handleScreenshot}
          onDownload={plugins.handleDownload}
          onPrint={plugins.handlePrint}
          onFullscreen={plugins.handleFullscreen}
          leftSlot={
            review.attachment.review_status &&
            review.attachment.review_status !== "pending" && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  review.attachment.review_status === "approved"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {review.attachment.review_status === "approved"
                  ? t("approved")
                  : t("changesRequested")}
              </span>
            )
          }
        />

        <DocumentViewer
          activeFileId={review.activeFileId}
          fileName={fileName}
          fileUrl={fileUrl}
          viewerRef={viewerRef}
          annotations
          annotationAuthor={displayName(session?.user?.name, "Client")}
        />

        <ReviewSubmitBar
          annotationCount={annotations.annotationCount}
          hasChanges={annotations.hasChanges}
          onSubmit={handleSubmitReview}
        />
      </div>
    </div>
  );
}
