"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import {
  MapPin,
  Check,
  ChevronDown,
  Trash2,
  X,
  MessageCircle,
  Plus,
  CheckSquare,
  ShieldCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/**
 * Manages open/close with a slide animation.
 * Returns: [shouldRender, animating] — render while closing, animating = "in" | "out" | null
 */
function useSlide(open: boolean, durationMs = 200) {
  const [render, setRender] = useState(open);
  const [stage, setStage] = useState<"in" | "out" | null>(open ? "in" : null);

  useEffect(() => {
    if (open) {
      setRender(true);
      // Force a frame so the initial translate(100%) is painted before we animate in
      requestAnimationFrame(() => requestAnimationFrame(() => setStage("in")));
    } else if (render) {
      setStage("out");
      const timer = setTimeout(() => {
        setRender(false);
        setStage(null);
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [open, render, durationMs]);

  return { shouldRender: render, stage };
}
import type { DbPinComment } from "@/types";

interface PinSidebarProps {
  pins: DbPinComment[];
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onResolvePin: (pinId: string, resolved: boolean) => void;
  onDeletePin: (pinId: string) => void;
  currentUserId: string;
  isStaff: boolean;
  open: boolean;
  onClose: () => void;
  /** When set, the form for a new pin is shown at the top of the sidebar. */
  pendingPin?: { xPercent: number; yPercent: number; page: number } | null;
  onSubmitComment: (data: {
    content: string;
    xPercent?: number | null;
    yPercent?: number | null;
    page?: number | null;
    requestApproval?: boolean;
    assignAsTask?: { assignedTo: string; dueDate?: string };
  }) => void;
  onCancelPending?: () => void;
  /** Clear the visual pending pin from the document without closing the form. */
  onClearPendingPin?: () => void;
  /** Enter pin mode so the user can click the document to place a pin. */
  onRequestPin?: () => void;
  /** Member data for assignee dropdown */
  members: { user_id: string; name: string }[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Collapsible sidebar panel listing all pin comments for an attachment. */
export function PinSidebar({
  pins,
  selectedPinId,
  onSelectPin,
  onResolvePin,
  onDeletePin,
  currentUserId,
  isStaff,
  open,
  onClose,
  pendingPin,
  onSubmitComment,
  onCancelPending,
  onClearPendingPin,
  onRequestPin,
  members,
}: PinSidebarProps) {
  const { shouldRender, stage } = useSlide(open);
  const [showNewForm, setShowNewForm] = useState(false);

  // Show form when pendingPin is set (from document click)
  const formVisible = showNewForm || !!pendingPin;

  if (!shouldRender) return null;

  const sorted = [...pins].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Build index map for pinned comments only (those with coordinates)
  const pinnedSorted = sorted.filter(
    (p) => p.x_percent !== null && p.y_percent !== null && p.page !== null
  );
  const pinIndexMap = new Map(pinnedSorted.map((p, i) => [p.id, i + 1]));

  return (
    <div
      className="absolute right-0 top-10 bottom-0 w-72 z-40 bg-[#0D0D0D] border-l border-[#222] flex flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out"
      style={{ transform: stage === "in" ? "translateX(0)" : "translateX(100%)" }}
    >
      {/* Header */}
      <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-[#222]">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#666]" />
          <span className="text-[13px] font-medium text-white">Comments</span>
          {pins.length > 0 && (
            <span className="text-[11px] text-[#666] bg-[#1A1A1A] px-1.5 py-0.5 rounded-full">
              {pins.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowNewForm(true)}
                className="text-[#666] hover:text-[#F5C518] transition-colors cursor-pointer p-0.5"
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New comment</TooltipContent>
          </Tooltip>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors cursor-pointer"
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
          onSubmit={(data) => {
            onSubmitComment(data);
            setShowNewForm(false);
          }}
          onCancel={() => {
            setShowNewForm(false);
            onCancelPending?.();
          }}
          onClearPin={onClearPendingPin}
          onRequestPin={onRequestPin}
        />
      )}

      {/* Pin list */}
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 && !formVisible ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MapPin className="w-8 h-8 text-[#333] mb-3" />
            <p className="text-[12px] text-[#555] text-center">
              No comments yet. Click the <MapPin className="w-3 h-3 inline" /> button and click anywhere on the file to add one.
            </p>
          </div>
        ) : (
          <div className="py-1">
            {sorted.map((pin) => {
              const isPinned =
                pin.x_percent !== null &&
                pin.y_percent !== null &&
                pin.page !== null;
              const pinIndex = pinIndexMap.get(pin.id);
              const isSelected = pin.id === selectedPinId;
              const canDelete = pin.user_id === currentUserId || isStaff;

              return (
                <button
                  key={pin.id}
                  onClick={() => onSelectPin(pin.id)}
                  className={`w-full text-left px-3 py-3 border-b border-[#1A1A1A] transition-colors cursor-pointer ${
                    isSelected ? "bg-[#111]" : "hover:bg-[#111]/50"
                  }`}
                >
                  {/* Pin number / icon + author + time + badges */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {isPinned ? (
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                          isSelected
                            ? "bg-[#F5C518] text-[#0D0D0D]"
                            : pin.resolved
                              ? "bg-[#1A1A1A] text-[#555]"
                              : "bg-[#1A1A1A] text-white"
                        }`}
                      >
                        {pin.resolved ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          pinIndex
                        )}
                      </span>
                    ) : (
                      <span
                        className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                          isSelected ? "text-[#F5C518]" : "text-[#555]"
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span
                      className={`text-[12px] font-medium truncate ${
                        pin.resolved ? "text-[#555]" : "text-[#A0A0A0]"
                      }`}
                    >
                      {pin.user_name}
                    </span>
                    {/* Badges */}
                    {pin.task_id !== null && (
                      <CheckSquare className="w-3 h-3 text-[#555] shrink-0" />
                    )}
                    {pin.request_approval && (
                      <ShieldCheck className="w-3 h-3 text-[#555] shrink-0" />
                    )}
                    <span className="text-[10px] text-[#555] ml-auto shrink-0">
                      {timeAgo(pin.created_at)}
                    </span>
                  </div>

                  {/* Content */}
                  <p
                    className={`text-[12px] ml-7 leading-relaxed ${
                      pin.resolved
                        ? "text-[#555] line-through"
                        : "text-[#A0A0A0]"
                    }`}
                  >
                    {pin.content}
                  </p>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-3 ml-7 mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={pin.resolved}
                      onCheckedChange={() => onResolvePin(pin.id, !pin.resolved)}
                      label={pin.resolved ? "Resolved" : "Resolve"}
                      className="[&_span]:text-[10px] [&_span]:text-[#555]"
                    />
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePin(pin.id);
                        }}
                        className="text-[#555] hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline form shown at the top of the sidebar for a new comment. */
function NewPinForm({
  pendingPin,
  members,
  onSubmit,
  onCancel,
  onClearPin,
  onRequestPin,
}: {
  pendingPin: { xPercent: number; yPercent: number; page: number } | null;
  members: { user_id: string; name: string }[];
  onSubmit: (data: {
    content: string;
    xPercent?: number | null;
    yPercent?: number | null;
    page?: number | null;
    requestApproval?: boolean;
    assignAsTask?: { assignedTo: string; dueDate?: string };
  }) => void;
  onCancel: () => void;
  /** Clear the visual pending pin from the document. */
  onClearPin?: () => void;
  /** Enter pin mode so the user can click the document to place a pin. */
  onRequestPin?: () => void;
}) {
  const [content, setContent] = useState("");
  const [pinAttached, setPinAttached] = useState(!!pendingPin);
  const [assignAsTask, setAssignAsTask] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [requestApproval, setRequestApproval] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Sync pinAttached when pendingPin changes
  useEffect(() => {
    if (pendingPin) {
      setPinAttached(true);
    }
  }, [pendingPin]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (!content.trim()) return;
    const data: Parameters<typeof onSubmit>[0] = {
      content: content.trim(),
      xPercent: pinAttached && pendingPin ? pendingPin.xPercent : null,
      yPercent: pinAttached && pendingPin ? pendingPin.yPercent : null,
      page: pinAttached && pendingPin ? pendingPin.page : null,
    };
    if (requestApproval) {
      data.requestApproval = true;
    }
    if (assignAsTask && assignedTo) {
      data.assignAsTask = {
        assignedTo,
        dueDate: dueDate || undefined,
      };
    }
    onSubmit(data);
  }

  const expandRef = useRef<HTMLDivElement>(null);
  const [expandHeight, setExpandHeight] = useState<number | null>(
    assignAsTask ? null : 0
  );

  // Measure and animate the expand section
  useEffect(() => {
    if (assignAsTask) {
      const el = expandRef.current;
      if (el) {
        // Measure natural height
        el.style.height = "auto";
        const h = el.scrollHeight;
        el.style.height = "0px";
        // Force reflow then animate to measured height
        requestAnimationFrame(() => {
          setExpandHeight(h);
        });
      }
    } else {
      setExpandHeight(0);
    }
  }, [assignAsTask]);

  return (
    <div className="border-b border-[#222] p-3">
      {/* Outer card wrapping the entire form */}
      <div className="rounded-lg border border-[#ffffff0a] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[13px] font-semibold text-white">
            Add New Comment
          </span>
          <button
            onClick={onCancel}
            className="text-[#666] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea area */}
        <div className="mx-3 rounded-lg border border-[#333] bg-[#1A1A1A] transition-colors duration-200 focus-within:border-[#F5C518]/30">
          {/* Pin badge row */}
          {pinAttached && pendingPin && (
            <div className="px-3 pt-2.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F5C518]" />
              <button
                onClick={() => {
                  setPinAttached(false);
                  onClearPin?.();
                }}
                className="text-[#555] hover:text-[#A0A0A0] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your comment..."
            rows={4}
            className="w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-white placeholder-[#555] outline-none! focus-visible:outline-none! border-none"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-end gap-0.5 px-2 py-1.5 border-t border-[#333]/60">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (pinAttached && pendingPin) {
                      setPinAttached(false);
                      onClearPin?.();
                    } else {
                      onRequestPin?.();
                    }
                  }}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    pinAttached && pendingPin
                      ? "text-[#F5C518] bg-[#F5C518]/10"
                      : "text-[#555] hover:text-[#A0A0A0]"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {pinAttached && pendingPin
                  ? "Unpin from document"
                  : "Place a pin on the document"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Assign as task */}
        <div className="px-3 py-2.5 border-t border-[#ffffff0a] mt-3">
          <Checkbox
            checked={assignAsTask}
            onCheckedChange={setAssignAsTask}
            label="Assign as task"
          />
        </div>

        {/* Animated expand for task fields */}
        <div
          ref={expandRef}
          className="overflow-hidden transition-[height] duration-200 ease-out"
          style={{ height: expandHeight ?? "auto" }}
        >
          <div className="px-3 pb-3 flex flex-col gap-2.5 border-t border-[#ffffff0a] pt-2.5">
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-text-muted w-[60px] shrink-0">
                Assignee
              </label>
              <div className="relative flex-1">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-md border border-[#ffffff0a] bg-bg-secondary pl-2.5 pr-7 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent/50 cursor-pointer appearance-none"
                >
                  <option value="">Select User</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-text-muted w-[60px] shrink-0">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Select Date"
                className="flex-1 rounded-md border border-[#ffffff0a] bg-bg-secondary px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent/50 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Request for approval — aligned with assign as task */}
        <div className="px-3 py-2.5 border-t border-[#ffffff0a]">
          <Checkbox
            checked={requestApproval}
            onCheckedChange={setRequestApproval}
            label="Request for approval"
            className="[&_span]:text-text-secondary"
          />
        </div>

        {/* Submit */}
        <div className="px-3 pb-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="rounded-lg bg-accent px-5 py-2 text-[13px] font-semibold text-text-on-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
