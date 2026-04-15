"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, MessageCircle, X, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { sortPinsByDate, buildPinIndexMap } from "@/lib/pinUtils";
import type { DbPinComment, UserRole } from "@/types";
import { useSlide } from "./useSlide";
import { PinCard } from "./PinCard";
import { NewPinForm } from "./NewPinForm";

interface PinSidebarProps {
  pins: DbPinComment[];
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onResolvePin: (pinId: string, resolved: boolean) => void;
  onEditPin: (pinId: string, content: string) => void | Promise<void>;
  onDeletePin: (pinId: string) => void;
  currentUserId: string;
  /** Whether the current user is a PM (org owner/admin) — PMs can delete any comment. */
  isPm: boolean;
  /** Current user role — used to gate comment form options. */
  role?: UserRole | null;
  open: boolean;
  onClose: () => void;
  /** When set, the form for a new pin is shown at the top of the sidebar. */
  pendingPin?: { xPercent: number; yPercent: number; page: number } | null;
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
  onEditPin,
  onDeletePin,
  currentUserId,
  isPm,
  role,
  open,
  onClose,
  pendingPin,
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
  const { shouldRender, stage } = useSlide(open);
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

  // Show form when pendingPin is set (from document click)
  const formVisible = showNewForm || !!pendingPin || !!requestChangesMode;

  if (!shouldRender) return null;

  const sorted = sortPinsByDate(pins);
  const pinIndexMap = buildPinIndexMap(pins);

  return (
    <div
      className="w-72 shrink-0 bg-bg-primary border-l border-border-default flex flex-col overflow-hidden transition-[width,opacity] duration-200 ease-out"
      style={{
        width: stage === "in" ? undefined : 0,
        opacity: stage === "in" ? 1 : 0,
      }}
    >
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
          <div className="flex flex-col gap-1.5 p-2">
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
