"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, MessageCircle, X, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { sortPinsByDate, buildPinIndexMap } from "@/lib/pinUtils";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { DbPinComment, PinShape, UserRole } from "@/types";
import type { PinStatus } from "@/lib/validations";
import { PinCard } from "./PinCard";
import { NewPinForm } from "./NewPinForm";

interface PinSidebarProps {
  pins: DbPinComment[];
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onResolvePin: (pinId: string, resolved: boolean) => void;
  /** Set a pin's 3-state markup status (Document Control). */
  onSetPinStatus?: (pinId: string, status: PinStatus) => void;
  /** When true, pin cards show the Open/Resolved/Closed dropdown. */
  enableStatus?: boolean;
  onEditPin: (pinId: string, content: string) => void | Promise<void>;
  onDeletePin: (pinId: string) => void;
  currentUserId: string;
  /** Whether the current user is a PM (org owner/admin) — PMs can delete any comment. */
  isPm: boolean;
  /** Current user role — used to gate comment form options. */
  role?: UserRole | null;
  onClose: () => void;
  /** When set, the form for a new pin is shown at the top of the sidebar. */
  pendingPin?: { xPercent: number; yPercent: number; page: number } | null;
  /** Shape annotations attached to the comment-in-progress. */
  pendingShapes?: ReadonlyArray<PinShape>;
  /** Clear every pending shape from the comment-in-progress. */
  onClearShapes?: () => void;
  onSubmitComment: (data: {
    content: string;
    xPercent?: number | null;
    yPercent?: number | null;
    page?: number | null;
    requestChanges?: boolean;
    assignAsTask?: { assignedTo: string; dueDate?: string };
  }) => void | Promise<void>;
  onCancelPending?: () => void;
  /** Clear the visual pending pin from the document without closing the form. */
  onClearPendingPin?: () => void;
  /** Enter pin mode so the user can click the document to place a pin. */
  onRequestPin?: () => void;
  /** When true, the new comment form pre-checks "Request changes" and locks it. */
  requestChangesMode?: boolean;
  /** Member data for assignee dropdown */
  members: { user_id: string; name: string }[];
  /** Default assignee (first architect on the project). */
  defaultAssignee?: string;
  /** Replies keyed by parent pin ID. */
  repliesMap?: Map<string, DbPinComment[]>;
  onFetchReplies?: (parentId: string) => void;
  onAddReply?: (parentId: string, content: string) => void | Promise<void>;
}

/** Collapsible sidebar panel listing all pin comments for an attachment. */
export function PinSidebar({
  pins,
  selectedPinId,
  onSelectPin,
  onResolvePin,
  onSetPinStatus,
  enableStatus,
  onEditPin,
  onDeletePin,
  currentUserId,
  isPm,
  role,
  onClose,
  pendingPin,
  pendingShapes,
  onClearShapes,
  onSubmitComment,
  onCancelPending,
  onClearPendingPin,
  onRequestPin,
  requestChangesMode,
  members,
  defaultAssignee,
  repliesMap,
  onFetchReplies,
  onAddReply,
}: PinSidebarProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected pin comment (e.g. from deep link)
  useEffect(() => {
    if (selectedPinId && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedPinId]);

  // Show form when pendingPin / pendingShapes is set (from document click or draw)
  const hasPendingShapes = !!pendingShapes && pendingShapes.length > 0;
  const formVisible =
    showNewForm || !!pendingPin || hasPendingShapes || !!requestChangesMode;

  const sorted = useMemo(() => sortPinsByDate(pins), [pins]);
  const pinIndexMap = useMemo(() => buildPinIndexMap(pins), [pins]);

  // Cascade pin cards in when the pin set changes (e.g. a new annotation).
  const listRef = useStaggerReveal<HTMLDivElement>(
    sorted.map((p) => p.id).join(",")
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-border-default">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-text-muted" />
          <span className="text-[13px] font-medium text-text-primary">
            Comments
          </span>
          {pins.length > 0 && (
            <span className="text-[11px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded-full">
              {pins.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowNewForm(true)}
                className="text-text-muted hover:text-[#F5C518] transition-colors cursor-pointer p-0.5"
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New comment</TooltipContent>
          </Tooltip>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close comments"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* New comment form */}
      {formVisible && (
        <NewPinForm
          pendingPin={pendingPin ?? null}
          pendingShapes={pendingShapes}
          onClearShapes={onClearShapes}
          members={members}
          defaultAssignee={defaultAssignee}
          role={role}
          requestChangesMode={requestChangesMode}
          onSubmit={(data) => {
            onSubmitComment(data);
            setShowNewForm(false);
          }}
          onCancel={() => {
            setShowNewForm(false);
            onCancelPending?.();
          }}
          onClearPin={() => {
            setShowNewForm(true);
            onClearPendingPin?.();
          }}
          onRequestPin={onRequestPin}
        />
      )}

      {/* Pin list */}
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 && !formVisible ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MapPin className="w-8 h-8 text-text-secondary mb-3" />
            <p className="text-[12px] text-text-secondary text-center">
              No comments yet. Click the <MapPin className="w-3 h-3 inline" />{" "}
              button and click anywhere on the file to add one.
            </p>
          </div>
        ) : (
          <div ref={listRef} className="flex flex-col gap-1.5 p-2">
            {sorted.map((pin) => (
              <PinCard
                key={pin.id}
                pin={pin}
                pinIndex={pinIndexMap.get(pin.id)}
                isSelected={pin.id === selectedPinId}
                selectedRef={pin.id === selectedPinId ? selectedRef : undefined}
                currentUserId={currentUserId}
                isPm={isPm}
                onSelect={() => onSelectPin(pin.id)}
                onResolve={(resolved) => onResolvePin(pin.id, resolved)}
                enableStatus={enableStatus}
                onSetStatus={(status) => onSetPinStatus?.(pin.id, status)}
                onEdit={(content) => onEditPin(pin.id, content)}
                onDelete={() => onDeletePin(pin.id)}
                replies={repliesMap?.get(pin.id)}
                onExpandReplies={() => onFetchReplies?.(pin.id)}
                onAddReply={(content) => onAddReply?.(pin.id, content)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
