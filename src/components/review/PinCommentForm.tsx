"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface PinCommentFormProps {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  /** Position hint for placement near the pin. */
  position?: { x: number; y: number };
}

/** Inline floating form for entering a pin comment. */
export function PinCommentForm({
  onSubmit,
  onCancel,
  position,
}: PinCommentFormProps) {
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
    <div
      style={
        position
          ? { left: position.x, top: position.y, position: "absolute" }
          : undefined
      }
      className="z-50 w-[280px] rounded-lg border border-border-default bg-bg-elevated p-3 shadow-xl"
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment…"
        rows={3}
        className="w-full resize-none rounded-md border border-border-default bg-bg-secondary px-2.5 py-2 text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:border-[#F5C518]/50"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-[12px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => content.trim() && onSubmit(content.trim())}
          disabled={!content.trim()}
          className="rounded-md bg-[#F5C518] px-3 py-1 text-[12px] font-semibold text-text-on-accent hover:bg-[#F5C518]/90 disabled:opacity-40 disabled:cursor-default transition-colors cursor-pointer"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
