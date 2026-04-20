"use client";

import { forwardRef, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  id?: string;
}

/**
 * Chip-style tag input. Space or Enter commits the current text as a pill;
 * Backspace on an empty field removes the last pill. Duplicates (case-insensitive)
 * are silently rejected.
 */
export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(
  (
    { value, onChange, label, placeholder, maxTags, disabled, id },
    forwardedRef
  ) => {
    const [draft, setDraft] = useState("");
    const innerRef = useRef<HTMLInputElement>(null);
    const setRef = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const commitDraft = () => {
      const tag = draft.trim();
      setDraft("");
      if (!tag) return;
      if (maxTags !== undefined && value.length >= maxTags) return;
      const lower = tag.toLowerCase();
      if (value.some((t) => t.toLowerCase() === lower)) return;
      onChange([...value, tag]);
    };

    const removeAt = (i: number) => {
      onChange(value.filter((_, idx) => idx !== i));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === " " || e.key === ",") {
        if (draft.trim()) {
          e.preventDefault();
          commitDraft();
        } else if (e.key === "Enter") {
          e.preventDefault();
        }
      } else if (e.key === "Backspace" && !draft && value.length > 0) {
        e.preventDefault();
        removeAt(value.length - 1);
      }
    };

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm transition-colors",
            "focus-within:outline-none focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30",
            disabled && "opacity-60 pointer-events-none"
          )}
          onClick={() => innerRef.current?.focus()}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {value.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[12px] text-accent"
              >
                <span className="truncate max-w-[180px]">{tag}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  className="text-accent/70 hover:text-accent"
                  aria-label={`Remove ${tag}`}
                  tabIndex={-1}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={setRef}
              id={inputId}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitDraft}
              placeholder={value.length === 0 ? placeholder : undefined}
              disabled={disabled}
              className="flex-1 min-w-[80px] bg-transparent outline-none text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>
      </div>
    );
  }
);

TagInput.displayName = "TagInput";
