"use client";

import { use, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignReview } from "./_hooks/useDesignReview";
import { usePdfPlugins } from "./_hooks/usePdfPlugins";
import { ThumbnailPanel } from "./_components/ThumbnailPanel";
import { ReviewToolbar } from "./_components/ReviewToolbar";
import { DocumentViewer } from "./_components/DocumentViewer";
import { CommentsPanel } from "./_components/CommentsPanel";

/** Design review workspace with file viewer, annotation tools, and comments panel. */
export default function DesignReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id, designId } = use(params);
  const router = useRouter();
  const viewerRef = useRef<PDFViewerRef>(null);

  const review = useDesignReview({ projectId: id, designId });
  const plugins = usePdfPlugins({ viewerRef, attachment: review.attachment });

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
          onClick={() => router.push(`/projects/${id}`)}
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
      {/* 1. Thumbnail Panel */}
      <ThumbnailPanel
        phaseFiles={review.phaseFiles}
        activeFileId={review.activeFileId}
        onSelectFile={review.setActiveFileId}
      />

      {/* 2. Center Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 2a. App toolbar */}
        <ReviewToolbar
          projectId={id}
          fileName={fileName}
          fileUrl={fileUrl}
          commentsOpen={review.commentsOpen}
          setCommentsOpen={review.setCommentsOpen}
          reviewingAs={review.reviewingAs}
          handleReview={review.handleReview}
          handleScreenshot={plugins.handleScreenshot}
          handleDownload={plugins.handleDownload}
          handlePrint={plugins.handlePrint}
          handleFullscreen={plugins.handleFullscreen}
          getPlugin={plugins.getPlugin}
        />

        {/* 2b. Document Viewer */}
        <DocumentViewer
          activeFileId={review.activeFileId}
          fileName={fileName}
          fileUrl={fileUrl}
          viewerRef={viewerRef}
        />
      </div>

      {/* 3. Comments Panel */}
      {review.commentsOpen && (
        <CommentsPanel
          comments={review.comments}
          newComment={review.newComment}
          setNewComment={review.setNewComment}
          submittingComment={review.submittingComment}
          handlePostComment={review.handlePostComment}
          onClose={() => review.setCommentsOpen(false)}
        />
      )}
    </div>
  );
}
