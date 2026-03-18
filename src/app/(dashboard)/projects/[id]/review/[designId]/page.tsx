"use client";

import { use, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { ArrowLeft, FileText, Loader2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignReview } from "./_hooks/useDesignReview";
import { useCommentTool } from "@/hooks/useCommentTool";
import { usePdfPlugins } from "@/hooks/usePdfPlugins";
import { ThumbnailPanel } from "./_components/ThumbnailPanel";
import { ReviewToolbar } from "./_components/ReviewToolbar";
import { DocumentViewer } from "./_components/DocumentViewer";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { authClient } from "@/lib/authClient";
import { displayName } from "@/lib/fileUtils";

/** Design review workspace with file viewer, annotation tools, and comments panel. */
export default function DesignReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id, designId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewerRef = useRef<PDFViewerRef>(null);

  const { data: session } = authClient.useSession();
  const review = useDesignReview({
    projectId: id,
    designId,
    basePath: "/projects",
    fetchReviews: true,
  });
  const plugins = usePdfPlugins({ viewerRef, attachment: review.attachment });
  const { commentToolActive, toggleCommentTool } = useCommentTool({
    viewerRef,
  });
  const [reviewsOpen, setReviewsOpen] = useState(
    searchParams.get("reviews") === "open"
  );

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
        phaseName={review.phaseName}
        loading={review.filesLoading}
        onSelectFile={review.setActiveFileId}
      />

      {/* 2. Center Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* 2a. Toolbar */}
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
          rightSlot={
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
          }
        />

        {/* 2b. Document Viewer */}
        <DocumentViewer
          activeFileId={review.activeFileId}
          fileName={fileName}
          fileUrl={fileUrl}
          viewerRef={viewerRef}
          annotations
          annotationAuthor={displayName(session?.user?.name)}
        />
        {/* 2c. Reviews Panel (overlay) */}
        {reviewsOpen && (
          <ReviewPanel
            reviews={review.reviews}
            onClose={() => setReviewsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
