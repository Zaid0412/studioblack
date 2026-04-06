"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import {
  MapPin,
  Check,
  Trash2,
  X,
  MessageCircle,
  Plus,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Pencil,
  MessageSquare,
  Send,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { sortPinsByDate, isPinned, buildPinIndexMap } from "@/lib/pinUtils";
import type { DbPinComment, UserRole } from "@/types";

/**
 * Manages open/close with a slide animation.
 * Returns: [shouldRender, animating] — render while closing, animating = "in" | "out" | null
 */
function useSlide(open: boolean, durationMs = 200) {
  // "closing" stays true during the exit animation, then flips to false
  const [closing, setClosing] = useState(false);
  const [stage, setStage] = useState<"in" | "out" | null>(open ? "in" : null);

  // Render when open OR during exit animation
  const shouldRender = open || closing;

  useEffect(() => {
    let cancelled = false;
    if (open) {
      // Double-rAF so the initial offscreen position paints before we animate in
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setClosing(false);
          setStage("in");
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    } else {
      // Start exit animation — timeout starts inside rAF to avoid race
      let timer: ReturnType<typeof setTimeout>;
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setStage("out");
        setClosing(true);
        timer = setTimeout(() => {
          if (cancelled) return;
          setClosing(false);
          setStage(null);
        }, durationMs);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [open, durationMs]);

  return { shouldRender, stage };
}

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
    requestApproval?: boolean;
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
  /** Replies keyed by parent pin ID. */
  repliesMap?: Map<string, DbPinComment[]>;
  onFetchReplies?: (parentId: string) => void;
  onAddReply?: (parentId: string, content: string) => void | Promise<void>;
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
            <span className="text-[11px] text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-full">
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

/** Individual comment card with edit, reply, and resolve functionality. */
function PinCard({
  pin,
  pinIndex,
  isSelected,
  selectedRef,
  currentUserId,
  isPm,
  onSelect,
  onResolve,
  onEdit,
  onDelete,
  replies,
  onExpandReplies,
  onAddReply,
}: {
  pin: DbPinComment;
  pinIndex?: number;
  isSelected: boolean;
  selectedRef?: React.Ref<HTMLDivElement>;
  currentUserId: string;
  isPm: boolean;
  onSelect: () => void;
  onResolve: (resolved: boolean) => void;
  onEdit: (content: string) => void | Promise<void>;
  onDelete: () => void;
  replies?: DbPinComment[];
  onExpandReplies?: () => void;
  onAddReply?: (content: string) => void | Promise<void>;
}) {
  const pinHasCoords = isPinned(pin);
  const canDelete = pin.user_id === currentUserId || isPm;
  const canEdit = pin.user_id === currentUserId;
  const isTemp = pin.id.startsWith("temp-");

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(pin.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const replyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (repliesOpen) replyRef.current?.focus();
  }, [repliesOpen]);

  async function handleEditSave() {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === pin.content) {
      setEditing(false);
      setEditContent(pin.content);
      return;
    }
    await onEdit(trimmed);
    setEditing(false);
  }

  function handleToggleReplies() {
    if (!repliesOpen && !replies && onExpandReplies) {
      onExpandReplies();
    }
    setRepliesOpen(!repliesOpen);
  }

  async function handleSubmitReply() {
    if (!replyText.trim() || replySubmitting) return;
    setReplySubmitting(true);
    try {
      await onAddReply?.(replyText.trim());
      setReplyText("");
    } finally {
      setReplySubmitting(false);
    }
  }

  return (
    <div
      ref={selectedRef}
      onClick={onSelect}
      className={`group w-full text-left rounded-lg border transition-colors cursor-pointer ${
        pin.request_changes
          ? isSelected
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30"
          : isSelected
            ? "bg-accent/5 border-accent/20"
            : "bg-bg-secondary border-border-default hover:border-border-light hover:bg-bg-elevated"
      } ${isTemp ? "opacity-60" : ""}`}
      role="button"
      tabIndex={0}
    >
      {/* Header: pin badge + author + time */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        {pinHasCoords ? (
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              isSelected
                ? "bg-[#F5C518] text-text-on-accent"
                : pin.resolved
                  ? "bg-bg-secondary text-text-secondary"
                  : "bg-bg-secondary text-text-primary"
            }`}
          >
            {pin.resolved ? <Check className="w-3 h-3" /> : pinIndex}
          </span>
        ) : (
          <span
            className={`w-5 h-5 flex items-center justify-center shrink-0 ${
              isSelected ? "text-[#F5C518]" : "text-text-secondary"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </span>
        )}
        <span
          className={`text-[12px] font-medium truncate ${
            pin.resolved ? "text-text-secondary" : "text-text-primary"
          }`}
        >
          {pin.user_name}
        </span>
        {pin.task_id !== null && (
          <CheckSquare className="w-3 h-3 text-text-secondary shrink-0" />
        )}
        {pin.request_approval && (
          <ShieldCheck className="w-3 h-3 text-text-secondary shrink-0" />
        )}
        {pin.request_changes && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
            <AlertTriangle className="w-2.5 h-2.5" />
            Changes Requested
          </span>
        )}
        <span className="text-[10px] text-text-secondary ml-auto shrink-0 flex items-center gap-1">
          {pin.updated_at && <span>(edited)</span>}
          {timeAgo(pin.created_at)}
        </span>
      </div>

      {/* Content — inline edit or display */}
      {editing ? (
        <div className="px-3 pb-2 ml-7" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={editRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleEditSave();
              } else if (e.key === "Escape") {
                setEditing(false);
                setEditContent(pin.content);
              }
            }}
            rows={3}
            className="w-full resize-none bg-bg-secondary border border-border-default rounded px-2 py-1.5 text-[12px] text-text-primary outline-none focus:border-[#F5C518]/30"
          />
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleEditSave}
              className="text-[10px] text-[#F5C518] hover:underline cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(pin.content);
              }}
              className="text-[10px] text-text-secondary hover:text-text-muted cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`text-[12px] px-3 pb-2 ml-7 leading-relaxed ${
            pin.resolved
              ? "text-text-secondary line-through"
              : "text-text-muted"
          }`}
        >
          {pin.content}
        </p>
      )}

      {/* Actions bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-t border-[#ffffff06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            checked={pin.resolved}
            onCheckedChange={() => onResolve(!pin.resolved)}
            label={pin.resolved ? "Resolved" : "Resolve"}
            className="[&_span]:text-[10px] [&_span]:text-text-secondary"
            disabled={isTemp}
          />
          {/* Reply count / toggle */}
          {(pin.reply_count > 0 || onAddReply) && !isTemp && (
            <button
              onClick={handleToggleReplies}
              className={`flex items-center gap-1 text-[10px] cursor-pointer transition-colors ${
                repliesOpen
                  ? "text-[#F5C518]"
                  : "text-text-secondary hover:text-text-muted"
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              {pin.reply_count > 0 && <span>{pin.reply_count}</span>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {canEdit && !isTemp && (
            <button
              onClick={() => setEditing(true)}
              className="text-text-secondary hover:text-text-muted transition-colors cursor-pointer p-1 opacity-0 group-hover:opacity-100"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {canDelete && !isTemp && (
            <button
              onClick={onDelete}
              className="text-text-secondary hover:text-red-400 transition-colors cursor-pointer p-1 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Reply thread */}
      {repliesOpen && (
        <div
          className="border-t border-[#ffffff06] px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {replies ? (
            replies.length > 0 ? (
              <div className="flex flex-col gap-2 mb-2">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex gap-2">
                    <div className="w-4 h-4 rounded-full bg-bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[8px] text-text-secondary font-bold">
                        {reply.user_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-text-muted">
                          {reply.user_name}
                        </span>
                        <span className="text-[9px] text-text-secondary">
                          {timeAgo(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-text-secondary mb-2">
                No replies yet
              </p>
            )
          ) : (
            <div className="flex justify-center py-2">
              <Loader2 className="w-3 h-3 animate-spin text-text-secondary" />
            </div>
          )}

          {/* Reply input */}
          {onAddReply && (
            <div className="flex items-center gap-1.5">
              <input
                ref={replyRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                placeholder="Reply…"
                className="flex-1 bg-bg-secondary border border-[#ffffff0a] rounded px-2 py-1 text-[11px] text-text-primary placeholder:text-text-secondary outline-none focus:border-[#F5C518]/30"
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || replySubmitting}
                className="text-text-secondary hover:text-[#F5C518] disabled:opacity-30 transition-colors cursor-pointer p-1"
              >
                {replySubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline form shown at the top of the sidebar for a new comment. */
function NewPinForm({
  pendingPin,
  members,
  role,
  requestChangesMode,
  onSubmit,
  onCancel,
  onClearPin,
  onRequestPin,
}: {
  pendingPin: { xPercent: number; yPercent: number; page: number } | null;
  members: { user_id: string; name: string }[];
  /** Current user role — used to gate comment form options. */
  role?: UserRole | null;
  /** When true, pre-check and lock "Request changes". */
  requestChangesMode?: boolean;
  onSubmit: (data: {
    content: string;
    xPercent?: number | null;
    yPercent?: number | null;
    page?: number | null;
    requestApproval?: boolean;
    requestChanges?: boolean;
    assignAsTask?: { assignedTo: string; dueDate?: string };
  }) => void | Promise<void>;
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
  const [requestChanges, setRequestChanges] = useState(!!requestChangesMode);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Sync pinAttached when pendingPin changes and auto-focus textarea
  useEffect(() => {
    if (pendingPin) {
      setPinAttached(true);
      textareaRef.current?.focus();
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

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    const data: Parameters<typeof onSubmit>[0] = {
      content: content.trim(),
      xPercent: pinAttached && pendingPin ? pendingPin.xPercent : null,
      yPercent: pinAttached && pendingPin ? pendingPin.yPercent : null,
      page: pinAttached && pendingPin ? pendingPin.page : null,
    };
    if (requestApproval) {
      data.requestApproval = true;
    }
    if (requestChanges) {
      data.requestChanges = true;
    }
    if (assignAsTask && assignedTo) {
      data.assignAsTask = {
        assignedTo,
        dueDate: dueDate || undefined,
      };
    }
    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
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
    <div className="border-b border-border-default p-3">
      {/* Outer card wrapping the entire form */}
      <div className="rounded-lg border border-[#ffffff0a] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[13px] font-semibold text-text-primary">
            Add New Comment
          </span>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea area */}
        <div className="mx-3 rounded-lg border border-border-default bg-bg-secondary transition-colors duration-200 focus-within:border-[#F5C518]/30">
          {/* Pin badge row */}
          {pinAttached && pendingPin && (
            <div className="px-3 pt-2.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F5C518]" />
              <button
                onClick={() => {
                  setPinAttached(false);
                  onClearPin?.();
                }}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
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
            className="w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-text-primary placeholder:text-text-secondary outline-none! focus-visible:outline-none! border-none"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-end gap-0.5 px-2 py-1.5 border-t border-border-default/60">
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
                      : "text-text-secondary hover:text-text-primary"
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

        {/* Request changes — only for PM and Client */}
        {(role === "pm" || role === "client") && (
          <div className="px-3 py-2.5 border-t border-[#ffffff0a] mt-3">
            <Checkbox
              checked={requestChanges}
              onCheckedChange={(checked: boolean) => {
                if (requestChangesMode) return;
                setRequestChanges(checked);
                if (checked) {
                  setPinAttached(true);
                  if (!pendingPin) onRequestPin?.();
                }
              }}
              disabled={requestChangesMode}
              label="Request changes"
              className="[&_span]:text-text-secondary"
            />
            {requestChanges && !pendingPin && (
              <p className="text-[11px] text-amber-500 mt-1.5 ml-6">
                Click on the document to place a pin
              </p>
            )}
          </div>
        )}

        {/* Assign as task — hidden when requestChanges is checked (task is auto-created) */}
        {!requestChanges && (
          <div
            className={`px-3 py-2.5 border-t border-[#ffffff0a] ${role === "pm" || role === "client" ? "" : "mt-3"}`}
          >
            <Checkbox
              checked={assignAsTask}
              onCheckedChange={setAssignAsTask}
              label="Assign as task"
            />
          </div>
        )}

        {/* Animated expand for task fields */}
        {!requestChanges && (
          <div
            ref={expandRef}
            className="overflow-hidden transition-[height] duration-200 ease-out"
            style={{ height: expandHeight ?? "auto" }}
          >
            <div className="px-3 pb-3 flex flex-col gap-3 border-t border-[#ffffff0a] pt-2.5">
              <div className="flex items-center gap-3">
                <label className="text-[11px] text-text-muted w-[60px] shrink-0">
                  Assignee
                </label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="flex-1 h-8 text-[12px] rounded-md border-[#ffffff0a] bg-bg-secondary">
                    <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] text-text-muted w-[60px] shrink-0">
                  Due Date
                </label>
                <DatePicker
                  value={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                  onChange={(d) =>
                    setDueDate(
                      d
                        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                        : ""
                    )
                  }
                  placeholder="Select Date"
                  className="flex-1 [&_button]:h-8 [&_button]:text-[12px] [&_button]:rounded-md [&_button]:border-[#ffffff0a] [&_button]:bg-bg-secondary [&_button]:px-2.5 [&_button]:py-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Request for approval — only for architects (not PM, not client) */}
        {role !== "pm" && role !== "client" && (
          <div className="px-3 py-2.5 border-t border-[#ffffff0a]">
            <Checkbox
              checked={requestApproval}
              onCheckedChange={setRequestApproval}
              label="Notify client for review"
              className="[&_span]:text-text-secondary"
            />
          </div>
        )}

        {/* Submit */}
        <div className="px-3 pb-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="rounded-lg bg-accent px-5 py-2 text-[13px] font-semibold text-text-on-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
