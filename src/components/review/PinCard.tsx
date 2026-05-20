"use client";

import { useState, useRef, useEffect } from "react";
import {
  Check,
  Circle,
  Trash2,
  MessageCircle,
  CheckSquare,
  AlertTriangle,
  Loader2,
  Pencil,
  MessageSquare,
  Send,
  Square,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { isPinned } from "@/lib/pinUtils";
import { timeAgo } from "@/lib/formatTime";
import type { DbPinComment } from "@/types";

/** Individual comment card with edit, reply, and resolve functionality. */
export function PinCard({
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

  const userInitial = pin.user_name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div
      ref={selectedRef}
      onClick={onSelect}
      className={`group w-full text-left rounded-[10px] border transition-colors cursor-pointer ${
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
      {/* Header: avatar + name/time + pin badge */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1.5">
        {/* Avatar */}
        <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-text-on-accent shrink-0">
          {userInitial}
        </span>

        {/* Name + time stacked */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span
            className={`text-[12px] font-semibold truncate ${
              pin.resolved ? "text-text-secondary" : "text-text-primary"
            }`}
          >
            {pin.user_name}
          </span>
          <span className="text-[10px] text-text-muted flex items-center gap-1">
            {pin.updated_at && <span>(edited)</span>}
            {timeAgo(pin.created_at)}
          </span>
        </div>

        {/* Badges: task, changes requested, pin number */}
        {pin.task_id !== null && (
          <CheckSquare className="w-3 h-3 text-text-secondary shrink-0" />
        )}
        {pin.request_changes && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
            <AlertTriangle className="w-2.5 h-2.5" />
            Changes
          </span>
        )}
        {pin.shape_type && (
          <span
            className="shrink-0"
            style={{ color: pin.shape_color ?? "currentColor" }}
            aria-label={`${pin.shape_type} annotation`}
          >
            {pin.shape_type === "rectangle" ? (
              <Square className="w-3 h-3" />
            ) : pin.shape_type === "circle" ? (
              <Circle className="w-3 h-3" />
            ) : (
              <Pencil className="w-3 h-3" />
            )}
          </span>
        )}
        {pinHasCoords ? (
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              isSelected
                ? "bg-accent text-text-on-accent"
                : pin.resolved
                  ? "bg-bg-elevated text-text-secondary"
                  : "bg-bg-elevated text-text-primary"
            }`}
          >
            {pin.resolved ? <Check className="w-3 h-3" /> : pinIndex}
          </span>
        ) : (
          <span
            className={`w-5 h-5 flex items-center justify-center shrink-0 ${
              isSelected ? "text-accent" : "text-text-secondary"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {/* Content — inline edit or display */}
      {editing ? (
        <div className="px-3.5 pb-2.5" onClick={(e) => e.stopPropagation()}>
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
            className="w-full resize-none bg-bg-elevated border border-border-default rounded-md px-2.5 py-2 text-[13px] text-text-primary outline-none focus:border-accent/30"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={handleEditSave}
              className="text-[11px] text-accent hover:underline cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(pin.content);
              }}
              className="text-[11px] text-text-secondary hover:text-text-muted cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`text-[13px] px-3.5 pb-2.5 leading-[1.55] ${
            pin.resolved
              ? "text-text-secondary line-through"
              : "text-text-primary"
          }`}
        >
          {pin.content}
        </p>
      )}

      {/* Actions bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2 border-t border-border-default/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5">
          <Checkbox
            checked={pin.resolved}
            onCheckedChange={() => onResolve(!pin.resolved)}
            label={pin.resolved ? "Resolved" : "Resolve"}
            className="[&_span]:text-[11px] [&_span]:text-text-secondary"
            disabled={isTemp}
          />
          {/* Reply count / toggle */}
          {(pin.reply_count > 0 || onAddReply) && !isTemp && (
            <button
              onClick={handleToggleReplies}
              aria-label={repliesOpen ? "Hide replies" : "Show replies"}
              className={`flex items-center gap-1.5 text-[11px] cursor-pointer transition-colors ${
                repliesOpen
                  ? "text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {pin.reply_count > 0 && <span>{pin.reply_count}</span>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {canEdit && !isTemp && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit comment"
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer p-1 opacity-0 group-hover:opacity-100"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && !isTemp && (
            <button
              onClick={onDelete}
              aria-label="Delete comment"
              className="text-text-secondary hover:text-red-400 transition-colors cursor-pointer p-1 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Reply thread */}
      {repliesOpen && (
        <div
          className="border-t border-border-default/10 px-3.5 py-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {replies ? (
            replies.length > 0 ? (
              <div className="flex flex-col gap-2.5 mb-2.5">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] text-accent font-bold">
                        {reply.user_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-text-primary">
                          {reply.user_name}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {timeAgo(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary leading-[1.55]">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-text-secondary mb-2">
                No replies yet
              </p>
            )
          ) : (
            <div className="flex justify-center py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-text-secondary" />
            </div>
          )}

          {/* Reply input */}
          {onAddReply && (
            <div className="flex items-center gap-2">
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
                className="flex-1 bg-bg-elevated border border-border-default/20 rounded-md px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-secondary outline-none focus:border-accent/30"
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || replySubmitting}
                className="text-text-secondary hover:text-accent disabled:opacity-30 transition-colors cursor-pointer p-1"
              >
                {replySubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
