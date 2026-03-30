"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { MapPin, Check, Trash2, X, MessageCircle } from "lucide-react";

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
  onPendingSubmit?: (content: string) => void;
  onPendingCancel?: () => void;
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
  onPendingSubmit,
  onPendingCancel,
}: PinSidebarProps) {
  const { shouldRender, stage } = useSlide(open);

  if (!shouldRender) return null;

  const sorted = [...pins].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

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
        <button
          onClick={onClose}
          className="text-[#666] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New comment form (when user clicked on document in pin mode) */}
      {pendingPin && onPendingSubmit && onPendingCancel && (
        <NewPinForm
          page={pendingPin.page}
          onSubmit={onPendingSubmit}
          onCancel={onPendingCancel}
        />
      )}

      {/* Pin list */}
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 && !pendingPin ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MapPin className="w-8 h-8 text-[#333] mb-3" />
            <p className="text-[12px] text-[#555] text-center">
              No comments yet. Click the <MapPin className="w-3 h-3 inline" /> button and click anywhere on the file to add one.
            </p>
          </div>
        ) : (
          <div className="py-1">
            {sorted.map((pin, i) => {
              const index = i + 1;
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
                  {/* Pin number + author + time */}
                  <div className="flex items-center gap-2 mb-1.5">
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
                        index
                      )}
                    </span>
                    <span
                      className={`text-[12px] font-medium truncate ${
                        pin.resolved ? "text-[#555]" : "text-[#A0A0A0]"
                      }`}
                    >
                      {pin.user_name}
                    </span>
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
                  <div className="flex items-center gap-3 ml-7 mt-2">
                    <label
                      className="flex items-center gap-1.5 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={pin.resolved}
                        onChange={() => onResolvePin(pin.id, !pin.resolved)}
                        className="w-3.5 h-3.5 rounded border-[#333] bg-[#1A1A1A] accent-[#F5C518] cursor-pointer"
                      />
                      <span className="text-[10px] text-[#555]">
                        {pin.resolved ? "Resolved" : "Resolve"}
                      </span>
                    </label>
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

/** Inline form shown at the top of the sidebar for a pending pin. */
function NewPinForm({
  page,
  onSubmit,
  onCancel,
}: {
  page: number;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (content.trim()) onSubmit(content.trim());
    }
  }

  return (
    <div className="border-b border-[#222] p-3 bg-[#111]">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-3.5 h-3.5 text-[#F5C518]" />
        <span className="text-[11px] text-[#A0A0A0]">
          New comment{page > 1 ? ` (page ${page})` : ""}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment…"
        rows={3}
        className="w-full resize-none rounded-md border border-[#333] bg-[#1A1A1A] px-2.5 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-[#F5C518]/50"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-[12px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => content.trim() && onSubmit(content.trim())}
          disabled={!content.trim()}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 text-[12px] font-semibold text-[#0D0D0D] hover:bg-[#F5C518]/90 disabled:opacity-40 disabled:cursor-default transition-colors cursor-pointer"
        >
          Post
        </button>
      </div>
    </div>
  );
}
