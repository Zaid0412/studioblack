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
import { isPdf, isSpreadsheet } from "@/lib/fileUtils";
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
  // Destructure stable callbacks (from useState/useCallback) to avoid stale deps
  const {
    setPinMode,
    setSelectedPinId,
    addPin,
    resolvePin,
    editPin,
    deletePin,
    repositionPin,
    fetchReplies,
    addReply,
  } = pinState;

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
  const [requestChangesMode, setRequestChangesMode] = useState(false);

  // Reset transient UI state when switching files
  useEffect(() => {
    setRequestChangesMode(false); // eslint-disable-line react-hooks/set-state-in-effect -- sync reset on file switch
    setPendingPin(null);
  }, [activeFileId]);

  // Auto-select pin comment from URL param (deep link from tasks)
  useEffect(() => {
    if (initialPinId && pinState.pins.length > 0) {
      setSelectedPinId(initialPinId);
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
    setPinMode((prev) => !prev);
    setPendingPin(null);
  }, [setPinMode]);

  // Keyboard shortcut: P to toggle pin mode, Escape to exit
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handleTogglePinMode();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPinMode(false);
        setPendingPin(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePinMode, setPinMode]);

  const handlePinClick = useCallback(
    (xPercent: number, yPercent: number, page: number) => {
      setPendingPin({ xPercent, yPercent, page });
      setCommentsOpen(true);
      // Exit pin mode — cursor goes back to normal after placing a pin
      setPinMode(false);
    },
    [setPinMode]
  );

  const handlePinFormSubmit = useCallback(
    async (data: {
      content: string;
      xPercent?: number | null;
      yPercent?: number | null;
      page?: number | null;
      requestApproval?: boolean;
      requestChanges?: boolean;
      assignAsTask?: { assignedTo: string; dueDate?: string };
    }) => {
      await addPin(data);
      setPendingPin(null);
      setRequestChangesMode(false);

      if (data.requestChanges) {
        toast({
          title: "Changes requested",
          description: "A task has been created for the architect",
          variant: "success",
        });
        // Update local attachment status so the UI reflects the change
        setAttachment((prev) =>
          prev ? { ...prev, review_status: "rejected" } : prev
        );
      }
    },
    [addPin, setAttachment]
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
    setPinMode(true);
  }, [setPinMode]);

  const handleRequestChanges = useCallback(() => {
    setRequestChangesMode(true);
    setPinMode(true);
    setCommentsOpen(true);
  }, [setPinMode]);

  const handleDownload = useCallback(async () => {
    if (!attachment) return;
    try {
      const blob = await upload.downloadFile(attachment.file_url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  }, [attachment]);

  const handleUploadSuccess = useCallback(async () => {
    const updated = await fetchAttachment(activeFileId);
    if (updated) setAttachment(updated);
  }, [fetchAttachment, activeFileId, setAttachment]);

  // Spreadsheet editing: allowed for the uploader when not frozen/approved
  const canEditSpreadsheet =
    !!attachment &&
    isSpreadsheet(attachment.file_name) &&
    session?.user?.id === attachment.uploaded_by &&
    attachment.review_status !== "approved" &&
    !attachment.frozen_at;

  const handleSaveSpreadsheet = useCallback(
    async (blob: Blob, newFileName: string) => {
      if (!attachment?.version_group) return;
      try {
        const file = new File([blob], newFileName, { type: blob.type });
        const { url } = await upload.uploadFile(file);
        const created = await attachmentsApi.create(id, {
          fileUrl: url,
          fileName: newFileName,
          versionGroup: attachment.version_group,
          phaseId: attachment.phase_id,
        });
        toast({
          title: "Version saved",
          description: `New version of "${newFileName}" created.`,
          variant: "success",
        });
        router.push(`/projects/${id}/review/${created.id}`);
      } catch (err) {
        console.error("[handleSaveSpreadsheet]", err);
        toast({
          title: "Save failed",
          description: "Could not save the spreadsheet. Please try again.",
          variant: "destructive",
        });
        throw err; // Re-throw so SpreadsheetViewer knows save failed
      }
    },
    [id, attachment, router, upload, toast]
  );

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

  const handleSendToClient = useCallback(async () => {
    if (!attachment) return;
    try {
      await attachmentsApi.sendToClient(id, attachment.id);
      toast({
        title: "Sent to client",
        description: `"${attachment.file_name}" is now visible to the client.`,
        variant: "success",
      });
      const updated = await fetchAttachment(activeFileId);
      if (updated) setAttachment(updated);
    } catch {
      toast({
        title: "Error",
        description: "Failed to send file to client.",
        variant: "error",
      });
    }
  }, [id, attachment, fetchAttachment, activeFileId, setAttachment]);

  // Client: submit an approval review (rejection goes through pin comment flow)
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
      title: t("approvedToast"),
      description: t("approvedDescription"),
      variant: "success",
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
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
        <div
          className={`flex-1 flex flex-col min-w-0 relative ${isClient ? "pb-20" : ""}`}
        >
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
            onSendToClient={
              !isClient && !attachment?.sent_to_client_at
                ? handleSendToClient
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
            canEditSpreadsheet={canEditSpreadsheet}
            onSaveSpreadsheet={handleSaveSpreadsheet}
            pinMode={pinState.pinMode}
            onPinClick={handlePinClick}
            renderPageOverlay={
              isPdf(fileName)
                ? (page) => (
                    <PinOverlay
                      pins={pinState.pins}
                      page={page}
                      selectedPinId={pinState.selectedPinId}
                      onSelectPin={setSelectedPinId}
                      pendingPin={pendingPin}
                      onRepositionPin={repositionPin}
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
                onSelectPin={setSelectedPinId}
                pendingPin={pendingPin}
                onRepositionPin={repositionPin}
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
              onRequestChanges={handleRequestChanges}
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
          onSelectPin={setSelectedPinId}
          onResolvePin={resolvePin}
          onEditPin={editPin}
          onDeletePin={deletePin}
          currentUserId={session?.user?.id ?? ""}
          isPm={isPm}
          role={role}
          open={commentsOpen}
          onClose={() => {
            setCommentsOpen(false);
            setPendingPin(null);
            setRequestChangesMode(false);
          }}
          pendingPin={pendingPin}
          onSubmitComment={handlePinFormSubmit}
          onCancelPending={handlePinFormCancel}
          onClearPendingPin={handleClearPendingPin}
          onRequestPin={handleRequestPin}
          requestChangesMode={requestChangesMode}
          members={members}
          repliesMap={pinState.repliesMap}
          onFetchReplies={fetchReplies}
          onAddReply={addReply}
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
