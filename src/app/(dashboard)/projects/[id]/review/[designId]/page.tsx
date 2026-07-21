"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  FileText,
  ClipboardCheck,
  MessageCircle,
  History,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useDesignReview } from "@/hooks/useDesignReview";
import { usePinComments } from "@/hooks/usePinComments";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { ThumbnailPanel } from "@/components/review/ThumbnailPanel";
import { ReviewToolbar } from "@/components/review/ReviewToolbar";
import { DocumentViewer } from "@/components/review/DocumentViewer";
import { PinOverlay } from "@/components/review/PinOverlay";
import { ShapeDrawingLayer } from "@/components/review/ShapeDrawingLayer";
import { AnnotationRail } from "@/components/review/AnnotationRail";
import { PinSidebar } from "@/components/review/PinSidebar";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { RevisionPanel, revLabel } from "@/components/review/RevisionPanel";
import { IssueRevisionDialog } from "@/components/review/IssueRevisionDialog";
import { ReviewSubmitBar } from "@/components/review/ReviewSubmitBar";
import { UploadDesignDialog } from "../../_components/UploadDesignDialog";
import { toast } from "@/components/ui/useToast";
import { attachments as attachmentsApi, upload, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { authClient } from "@/lib/authClient";
import { useFlag } from "@/hooks/useFlag";
import { isPdf, isSpreadsheet } from "@/lib/fileUtils";
import { MAX_SHAPES_PER_PIN, type IssuePurpose } from "@/lib/validations";
import type { PinShape, DbDrawingRevision } from "@/types";
import { useSidebar } from "@/components/layout/SidebarContext";

/**
 * Stable client-side id for items in the pending-shapes list. Uses
 * `crypto.randomUUID` when available (modern browsers + Node 19+) and falls
 * back to a base-36 random string for older runtimes. The id only needs to be
 * unique within the pending batch — it never leaves the client.
 */
function makeShapeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

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
  }, [collapse]);

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
    updateAttachment,
    refreshAttachment,
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
    setDrawTool,
    setDrawColor,
    setDrawStrokeWidth,
    setDrawOpacity,
    setDrawFill,
    addPin,
    resolvePin,
    setPinStatus,
    editPin,
    deletePin,
    repositionPin,
    fetchReplies,
    addReply,
  } = pinState;

  // Design → Document Control: pin 3-state status + drawing revisions.
  const docControl = useFlag("designDocumentControl");
  const { data: revData, mutate: mutateRevisions } = useSWR<{
    revisions: DbDrawingRevision[];
  }>(
    docControl && activeFileId
      ? API.attachmentRevisions(id, activeFileId)
      : null
  );
  const revisions = revData?.revisions ?? [];
  const currentRevLabel =
    revisions.length > 0 ? revLabel(revisions[0].rev_number) : null;
  const nextRevLabel = revLabel((revisions[0]?.rev_number ?? -1) + 1);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  const handleIssueRevision = useCallback(
    async (purpose: IssuePurpose) => {
      setIssuing(true);
      try {
        await attachmentsApi.issueRevision(id, activeFileId, purpose);
        toast({
          title: "Revision issued",
          description: `${nextRevLabel} is now the current revision. This version is read-only.`,
          variant: "success",
        });
        setIssueOpen(false);
        await Promise.all([refreshAttachment(), mutateRevisions()]);
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof ApiError ? err.message : "Failed to issue revision.",
          variant: "error",
        });
      } finally {
        setIssuing(false);
      }
    },
    [id, activeFileId, nextRevLabel, refreshAttachment, mutateRevisions]
  );

  // Org members for assignee dropdown (same source as tasks page)
  const { members: orgMembers } = useOrgMembers({ assignableOnly: true });
  const members = useMemo(
    () => orgMembers.map((m) => ({ user_id: m.userId, name: m.user.name })),
    [orgMembers]
  );
  const defaultAssignee = useMemo(
    () => orgMembers.find((m) => m.role === "member")?.userId ?? "",
    [orgMembers]
  );

  // Pending pin: stores the click coordinates while the form is open
  const [pendingPin, setPendingPin] = useState<{
    xPercent: number;
    yPercent: number;
    page: number;
  } | null>(null);

  // Pending shapes: stores the drawn shapes (in draw order) while the comment
  // form is open. The shape tool stays active across draws so the user can
  // attach multiple shapes to one comment. Mutually exclusive with pendingPin.
  // All shapes in a single pending batch belong to the same `page`; drawing
  // on a different page warns and preserves the current batch.
  //
  // Each item carries a stable client-side `id` so React keys in PinOverlay
  // survive batch updates (the array reference changes on every append).
  const [pendingShapes, setPendingShapes] = useState<{
    shapes: Array<{ id: string; shape: PinShape }>;
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
    setPendingShapes(null);
    setDrawTool(null);
  }, [activeFileId, setDrawTool]);

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
  }, [
    initialPinId,
    pinState.pins.length,
    setSelectedPinId,
    router,
    searchParams,
  ]);

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
        setDrawTool(null);
        setPendingPin(null);
        setPendingShapes(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePinMode, setPinMode, setDrawTool]);

  const handlePinClick = useCallback(
    (xPercent: number, yPercent: number, page: number) => {
      setPendingPin({ xPercent, yPercent, page });
      setPendingShapes(null);
      setCommentsOpen(true);
      // Exit pin mode — cursor goes back to normal after placing a pin
      setPinMode(false);
    },
    [setPinMode]
  );

  const handleShapeComplete = useCallback((shape: PinShape, page: number) => {
    const newItem = { id: makeShapeId(), shape };
    setPendingShapes((prev) => {
      // First draw — start a fresh batch.
      if (!prev) {
        return { shapes: [newItem], page };
      }
      // Drawing on a different page while a batch is in flight: warn and
      // preserve the in-progress batch instead of silently dropping it.
      if (prev.page !== page) {
        if (prev.shapes.length > 0) {
          toast({
            title: "Shape ignored",
            description: `Finish or cancel the comment on page ${prev.page} first.`,
            variant: "warning",
          });
          return prev;
        }
        return { shapes: [newItem], page };
      }
      if (prev.shapes.length >= MAX_SHAPES_PER_PIN) {
        toast({
          title: "Shape limit reached",
          description: `A single comment can hold up to ${MAX_SHAPES_PER_PIN} shapes.`,
          variant: "warning",
        });
        return prev;
      }
      return { shapes: [...prev.shapes, newItem], page };
    });
    setPendingPin(null);
    setCommentsOpen(true);
    // Tool stays active so the user can keep drawing more shapes onto the
    // same comment.
  }, []);

  const handleClearShapes = useCallback(() => {
    setPendingShapes(null);
  }, []);

  const handlePinFormSubmit = useCallback(
    async (data: {
      content: string;
      xPercent?: number | null;
      yPercent?: number | null;
      page?: number | null;
      requestChanges?: boolean;
      assignAsTask?: { assignedTo: string; dueDate?: string };
    }) => {
      // If shapes are pending, fold them into the addPin call so the server
      // persists them in one transaction. Strip the client-side ids — the API
      // contract only sees the raw PinShape geometry + style.
      const enriched =
        pendingShapes && pendingShapes.shapes.length > 0
          ? {
              ...data,
              shapes: pendingShapes.shapes.map((item) => item.shape),
              page: pendingShapes.page,
            }
          : data;
      await addPin(enriched);
      setPendingPin(null);
      setPendingShapes(null);
      setRequestChangesMode(false);

      if (data.requestChanges) {
        toast({
          title: "Changes requested",
          description: "A task has been created for the architect",
          variant: "success",
        });
        // Update local attachment status so the UI reflects the change
        updateAttachment((prev) =>
          prev ? { ...prev, review_status: "rejected" } : prev
        );
      }
    },
    [addPin, pendingShapes, updateAttachment]
  );

  const handlePinFormCancel = useCallback(() => {
    setPendingPin(null);
    setPendingShapes(null);
  }, []);

  const handleClearPendingPin = useCallback(() => {
    setPendingPin(null);
    setPendingShapes(null);
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
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download the file. Please try again.",
        variant: "error",
      });
    }
  }, [attachment]);

  const handleUploadSuccess = useCallback(async () => {
    await refreshAttachment();
  }, [refreshAttachment]);

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
      await refreshAttachment();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update freeze status.",
        variant: "error",
      });
    }
  }, [id, attachment, refreshAttachment]);

  const handleSendToClient = useCallback(async () => {
    if (!attachment) return;
    try {
      await attachmentsApi.sendToClient(id, attachment.id);
      toast({
        title: "Sent to client",
        description: `"${attachment.file_name}" is now visible to the client.`,
        variant: "success",
      });
      await refreshAttachment();
    } catch {
      toast({
        title: "Error",
        description: "Failed to send file to client.",
        variant: "error",
      });
    }
  }, [id, attachment, refreshAttachment]);

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

    await refreshAttachment();
  }

  if (review.initialLoading) {
    return (
      <div className="flex -m-4 lg:-m-8" style={{ height: "calc(100vh)" }}>
        {/* Thumbnail panel skeleton */}
        <div className="hidden lg:flex flex-col w-[180px] border-r border-border-default bg-bg-secondary p-3 gap-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-full aspect-[3/4] rounded-lg" />
          ))}
        </div>
        {/* Main viewer skeleton */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar skeleton */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-default">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-40" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          </div>
          {/* Document area skeleton */}
          <div className="flex-1 flex items-center justify-center bg-bg-secondary">
            <Skeleton className="w-[60%] max-w-[600px] aspect-[3/4] rounded-lg" />
          </div>
        </div>
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
            onIssueRevision={
              !isClient && isPm && docControl && !!attachment?.version_group
                ? () => setIssueOpen(true)
                : undefined
            }
            currentRevLabel={currentRevLabel}
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
                        if (next) {
                          setReviewsOpen(false);
                          setRevisionsOpen(false);
                        }
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
                          if (next) {
                            setCommentsOpen(false);
                            setRevisionsOpen(false);
                          }
                        }}
                        className={`cursor-pointer transition-colors flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
                          reviewsOpen
                            ? "bg-[#F5C518]/15 text-[#F5C518]"
                            : (review.reviews ?? []).length > 0
                              ? "bg-bg-elevated text-text-secondary hover:text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {(review.reviews ?? []).length > 0 && (
                          <span>{(review.reviews ?? []).length}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Reviews</TooltipContent>
                  </Tooltip>
                )}
                {/* PM: Revisions toggle (Document Control) */}
                {!isClient && docControl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          const next = !revisionsOpen;
                          setRevisionsOpen(next);
                          if (next) {
                            setCommentsOpen(false);
                            setReviewsOpen(false);
                          }
                        }}
                        className={`cursor-pointer transition-colors flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
                          revisionsOpen
                            ? "bg-[#F5C518]/15 text-[#F5C518]"
                            : revisions.length > 0
                              ? "bg-bg-elevated text-text-secondary hover:text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        {revisions.length > 0 && (
                          <span>{revisions.length}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Revisions</TooltipContent>
                  </Tooltip>
                )}
              </>
            }
          />

          <div className="flex-1 flex min-h-0">
            <AnnotationRail
              pinModeActive={pinState.pinMode}
              onTogglePinMode={handleTogglePinMode}
              drawTool={pinState.drawTool}
              onSelectDrawTool={setDrawTool}
              drawColor={pinState.drawColor}
              onSelectDrawColor={setDrawColor}
              drawStrokeWidth={pinState.drawStrokeWidth}
              onSelectDrawStrokeWidth={setDrawStrokeWidth}
              drawOpacity={pinState.drawOpacity}
              onSelectDrawOpacity={setDrawOpacity}
              drawFill={pinState.drawFill}
              onSelectDrawFill={setDrawFill}
              hideShapeTools={isSpreadsheet(fileName)}
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
                      <>
                        <PinOverlay
                          pins={pinState.pins}
                          page={page}
                          selectedPinId={pinState.selectedPinId}
                          onSelectPin={setSelectedPinId}
                          pendingPin={pendingPin}
                          pendingShapes={pendingShapes}
                          onRepositionPin={repositionPin}
                          pinMode={pinState.pinMode}
                          currentUserId={session?.user?.id ?? ""}
                          onRepositionPendingPin={handleRepositionPendingPin}
                        />
                        {pinState.drawTool && (
                          <ShapeDrawingLayer
                            page={page}
                            tool={pinState.drawTool}
                            color={pinState.drawColor}
                            strokeWidth={pinState.drawStrokeWidth}
                            opacity={pinState.drawOpacity}
                            fill={pinState.drawFill}
                            onComplete={handleShapeComplete}
                          />
                        )}
                      </>
                    )
                  : undefined
              }
            >
              {/* Pin markers overlay — for images (page 1) */}
              {!isPdf(fileName) && (
                <>
                  <PinOverlay
                    pins={pinState.pins}
                    page={1}
                    selectedPinId={pinState.selectedPinId}
                    onSelectPin={setSelectedPinId}
                    pendingPin={pendingPin}
                    pendingShapes={pendingShapes}
                    onRepositionPin={repositionPin}
                    pinMode={pinState.pinMode}
                    currentUserId={session?.user?.id ?? ""}
                    onRepositionPendingPin={handleRepositionPendingPin}
                  />
                  {pinState.drawTool && !isSpreadsheet(fileName) && (
                    <ShapeDrawingLayer
                      page={1}
                      tool={pinState.drawTool}
                      color={pinState.drawColor}
                      strokeWidth={pinState.drawStrokeWidth}
                      opacity={pinState.drawOpacity}
                      fill={pinState.drawFill}
                      onComplete={handleShapeComplete}
                    />
                  )}
                </>
              )}
            </DocumentViewer>
          </div>

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
            reviews={review.reviews ?? []}
            onClose={() => setReviewsOpen(false)}
          />
        )}

        {/* PM: Revisions Panel (Document Control) — flex sibling */}
        {!isClient && docControl && revisionsOpen && (
          <RevisionPanel
            revisions={revisions}
            onClose={() => setRevisionsOpen(false)}
          />
        )}

        {/* Pin comments sidebar — flex sibling, pushes document viewer */}
        <PinSidebar
          pins={pinState.pins}
          selectedPinId={pinState.selectedPinId}
          onSelectPin={setSelectedPinId}
          onResolvePin={resolvePin}
          onSetPinStatus={setPinStatus}
          enableStatus={docControl}
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
          pendingShapes={pendingShapes?.shapes.map((item) => item.shape) ?? []}
          onClearShapes={handleClearShapes}
          onSubmitComment={handlePinFormSubmit}
          onCancelPending={handlePinFormCancel}
          onClearPendingPin={handleClearPendingPin}
          onRequestPin={handleRequestPin}
          requestChangesMode={requestChangesMode}
          members={members}
          defaultAssignee={defaultAssignee}
          repliesMap={pinState.repliesMap}
          onFetchReplies={fetchReplies}
          onAddReply={addReply}
        />
      </div>

      {/* PM: Upload New Version Dialog */}
      {!isClient && attachment?.version_group && (
        <UploadDesignDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          projectId={id}
          phaseId={attachment.phase_id}
          versionGroup={attachment.version_group}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* PM: Issue Revision Dialog (Document Control) */}
      {!isClient && isPm && docControl && (
        <IssueRevisionDialog
          open={issueOpen}
          onOpenChange={setIssueOpen}
          nextRevLabel={nextRevLabel}
          submitting={issuing}
          onIssue={handleIssueRevision}
        />
      )}
    </div>
  );
}
