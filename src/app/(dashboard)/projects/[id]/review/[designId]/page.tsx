"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  FileText,
  Loader2,
  ClipboardCheck,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useDesignReview } from "@/hooks/useDesignReview";
import { usePinComments } from "@/hooks/usePinComments";
import { useUserRole } from "@/hooks/useUserRole";
import { ThumbnailPanel } from "@/components/review/ThumbnailPanel";
import { ReviewToolbar } from "@/components/review/ReviewToolbar";
import { DocumentViewer } from "@/components/review/DocumentViewer";
import { PinOverlay } from "@/components/review/PinOverlay";
import { PinSidebar } from "@/components/review/PinSidebar";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { ReviewSubmitBar } from "@/components/review/ReviewSubmitBar";
import { UploadDialog } from "@/components/ui/UploadDialog";
import { toast } from "@/components/ui/useToast";
import {
  attachments as attachmentsApi,
  projects as projectsApi,
  upload,
  ApiError,
} from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { isPdf } from "@/lib/fileUtils";
import { useSidebar } from "@/components/layout/SidebarContext";

/** Unified design review workspace — adapts to PM/architect or client role. */
export default function DesignReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id, designId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("clientReview");
  const tc = useTranslations("common");

  const { role } = useUserRole();
  const isClient = role === "client";
  const isPm = role === "pm";
  const { data: session } = authClient.useSession();
  const { collapse } = useSidebar();

  // Auto-collapse main sidebar when entering the file viewer
  useEffect(() => {
    collapse();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const pinState = usePinComments({
    projectId: id,
    attachmentId: activeFileId,
    userName: session?.user?.name ?? "",
  });

  // Fetch project members for assignee dropdown
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>(
    []
  );
  useEffect(() => {
    projectsApi
      .get<{
        members: { user_id: string; name: string; email: string }[];
      }>(id)
      .then((p) => setMembers(p.members ?? []))
      .catch(() => {});
  }, [id]);

  // Pending pin: stores the click coordinates while the form is open
  const [pendingPin, setPendingPin] = useState<{
    xPercent: number;
    yPercent: number;
    page: number;
  } | null>(null);

  const [reviewsOpen, setReviewsOpen] = useState(
    searchParams.get("reviews") === "open"
  );
  const initialPinId = searchParams.get("pinId");
  const [commentsOpen, setCommentsOpen] = useState(
    searchParams.get("comments") === "open"
  );
  const [uploadOpen, setUploadOpen] = useState(false);

  // Auto-select pin comment from URL param (deep link from tasks)
  useEffect(() => {
    if (initialPinId && pinState.pins.length > 0) {
      pinState.setSelectedPinId(initialPinId);
      // Clean up URL params after consuming them
      const params = new URLSearchParams(searchParams.toString());
      params.delete("pinId");
      params.delete("comments");
      router.replace(
        `${window.location.pathname}${params.size ? `?${params}` : ""}`,
        { scroll: false }
      );
    }
  }, [initialPinId, pinState.pins.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePinMode = useCallback(() => {
    pinState.setPinMode(!pinState.pinMode);
    setPendingPin(null);
  }, [pinState]);

  // Keyboard shortcut: P to toggle pin mode, Escape to exit
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handleTogglePinMode();
      } else if (e.key === "Escape" && pinState.pinMode) {
        e.preventDefault();
        pinState.setPinMode(false);
        setPendingPin(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePinMode, pinState]);

  const handlePinClick = useCallback(
    (xPercent: number, yPercent: number, page: number) => {
      setPendingPin({ xPercent, yPercent, page });
      setCommentsOpen(true);
      // Exit pin mode — cursor goes back to normal after placing a pin
      pinState.setPinMode(false);
    },
    [pinState]
  );

  const handlePinFormSubmit = useCallback(
    async (data: {
      content: string;
      xPercent?: number | null;
      yPercent?: number | null;
      page?: number | null;
      requestApproval?: boolean;
      assignAsTask?: { assignedTo: string; dueDate?: string };
    }) => {
      await pinState.addPin(data);
      setPendingPin(null);
    },
    [pinState]
  );

  const handlePinFormCancel = useCallback(() => {
    setPendingPin(null);
  }, []);

  const handleClearPendingPin = useCallback(() => {
    setPendingPin(null);
  }, []);

  const handleRepositionPendingPin = useCallback(
    (xPercent: number, yPercent: number) => {
      setPendingPin((prev) => (prev ? { ...prev, xPercent, yPercent } : null));
    },
    []
  );

  const handleRequestPin = useCallback(() => {
    pinState.setPinMode(true);
  }, [pinState]);

  const handleDownload = useCallback(async () => {
    if (!attachment) return;
    try {
      const blob = await upload.downloadFile(attachment.file_url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  }, [attachment]);

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

  // Client: submit a review
  async function handleSubmitReview(
    status: "approved" | "rejected",
    comment: string
  ) {
    try {
      await attachmentsApi.submitReview(id, activeFileId, {
        status,
        comment,
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

    const updated = await fetchAttachment(activeFileId);
    if (updated) setAttachment(updated);
  }

  if (review.loading) {
    return (
      <div
        className="flex items-center justify-center -m-4 lg:-m-8"
        style={{ height: "calc(100vh)" }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-[#F5C518]" />
      </div>
    );
  }

  if (!attachment) {
    return (
      <div
        className="flex flex-col items-center justify-center -m-4 lg:-m-8 gap-4"
        style={{ height: "calc(100vh)" }}
      >
        <FileText className="w-12 h-12 text-text-muted" />
        <p className="text-text-secondary text-sm">Attachment not found</p>
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
    <div className="flex -m-4 lg:-m-8" style={{ height: "calc(100vh)" }}>
      <ThumbnailPanel
        phaseFiles={review.phaseFiles}
        activeFileId={activeFileId}
        phaseName={review.phaseName}
        loading={review.filesLoading}
        onSelectFile={setActiveFileId}
      />

      <div className="flex-1 flex min-w-0">
        {/* Document area: toolbar + viewer + overlays */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <ReviewToolbar
            backPath={`/projects/${id}`}
            fileName={fileName}
            fileUrl={fileUrl}
            pinModeActive={pinState.pinMode}
            onTogglePinMode={handleTogglePinMode}
            onDownload={handleDownload}
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
              <>
                {/* Comments sidebar toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        const next = !commentsOpen;
                        setCommentsOpen(next);
                        if (next) setReviewsOpen(false);
                      }}
                      className={`cursor-pointer transition-colors flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
                        commentsOpen
                          ? "bg-[#F5C518]/15 text-[#F5C518]"
                          : pinState.pins.length > 0
                            ? "bg-bg-elevated text-text-secondary hover:text-text-primary"
                            : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {pinState.unresolvedCount > 0 && (
                        <span>{pinState.unresolvedCount}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Pin comments</TooltipContent>
                </Tooltip>
                {/* PM: Reviews toggle */}
                {!isClient && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          const next = !reviewsOpen;
                          setReviewsOpen(next);
                          if (next) setCommentsOpen(false);
                        }}
                        className={`cursor-pointer transition-colors flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
                          reviewsOpen
                            ? "bg-[#F5C518]/15 text-[#F5C518]"
                            : review.reviews.length > 0
                              ? "bg-bg-elevated text-text-secondary hover:text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {review.reviews.length > 0 && (
                          <span>{review.reviews.length}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Reviews</TooltipContent>
                  </Tooltip>
                )}
              </>
            }
          />

          <DocumentViewer
            activeFileId={activeFileId}
            fileName={fileName}
            fileUrl={fileUrl}
            pinMode={pinState.pinMode}
            onPinClick={handlePinClick}
            renderPageOverlay={
              isPdf(fileName)
                ? (page) => (
                    <PinOverlay
                      pins={pinState.pins}
                      page={page}
                      selectedPinId={pinState.selectedPinId}
                      onSelectPin={pinState.setSelectedPinId}
                      pendingPin={pendingPin}
                      onRepositionPin={pinState.repositionPin}
                      pinMode={pinState.pinMode}
                      currentUserId={session?.user?.id ?? ""}
                      onRepositionPendingPin={handleRepositionPendingPin}
                    />
                  )
                : undefined
            }
          >
            {/* Pin markers overlay — for images (page 1) */}
            {!isPdf(fileName) && (
              <PinOverlay
                pins={pinState.pins}
                page={1}
                selectedPinId={pinState.selectedPinId}
                onSelectPin={pinState.setSelectedPinId}
                pendingPin={pendingPin}
                onRepositionPin={pinState.repositionPin}
                pinMode={pinState.pinMode}
                currentUserId={session?.user?.id ?? ""}
                onRepositionPendingPin={handleRepositionPendingPin}
              />
            )}
          </DocumentViewer>

          {/* Client: Review Submit Bar */}
          {isClient && (
            <ReviewSubmitBar
              onSubmit={handleSubmitReview}
              pinCount={pinState.unresolvedCount}
            />
          )}
        </div>

        {/* PM: Reviews Panel — flex sibling, pushes document viewer */}
        {!isClient && reviewsOpen && (
          <ReviewPanel
            reviews={review.reviews}
            onClose={() => setReviewsOpen(false)}
          />
        )}

        {/* Pin comments sidebar — flex sibling, pushes document viewer */}
        <PinSidebar
          pins={pinState.pins}
          selectedPinId={pinState.selectedPinId}
          onSelectPin={pinState.setSelectedPinId}
          onResolvePin={pinState.resolvePin}
          onEditPin={pinState.editPin}
          onDeletePin={pinState.deletePin}
          currentUserId={session?.user?.id ?? ""}
          isPm={isPm}
          open={commentsOpen}
          onClose={() => {
            setCommentsOpen(false);
            setPendingPin(null);
          }}
          pendingPin={pendingPin}
          onSubmitComment={handlePinFormSubmit}
          onCancelPending={handlePinFormCancel}
          onClearPendingPin={handleClearPendingPin}
          onRequestPin={handleRequestPin}
          members={members}
          repliesMap={pinState.repliesMap}
          onFetchReplies={pinState.fetchReplies}
          onAddReply={pinState.addReply}
        />
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
