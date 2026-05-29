"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";
import { formatFeetInches, parseFeetInches } from "../_lib/formatters";

type EditableMode = "number" | "text" | "feet-inches";

interface BoqEditableCellProps {
  /** Raw underlying value — used to seed the input and detect no-op saves. */
  value: string | number;
  /** Formatted text shown when not editing. */
  display: string;
  mode?: EditableMode;
  disabled?: boolean;
  /**
   * On commit, receives the canonical string written back to the API.
   * For "feet-inches", this is decimal feet (e.g. `"7.8333..."`), not the
   * user's typed `7'10"` string — the cell parses and normalises first.
   */
  onSave: (next: string) => Promise<void> | void;
  className?: string;
  inputClassName?: string;
  align?: "left" | "right";
  min?: number;
  max?: number;
  placeholder?: string;
  ariaLabel?: string;
}

/** Inline-editable cell for BOQ table rows. Invalid number input reverts silently. */
export function BoqEditableCell({
  value,
  display,
  mode = "text",
  disabled,
  onSave,
  className,
  inputClassName,
  align = "left",
  min,
  max,
  placeholder,
  ariaLabel,
}: BoqEditableCellProps) {
  // Feet-inches edits show the formatted `7'10"` form, not the raw decimal,
  // so the user can tweak the notation directly instead of mental arithmetic.
  const seedDraft = () => {
    if (mode === "feet-inches") {
      const n = typeof value === "string" ? parseFloat(value) : value;
      return Number.isFinite(n) && n > 0 ? formatFeetInches(n) : "";
    }
    return String(value ?? "");
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(seedDraft);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(seedDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing, mode]);

  const startEdit = () => {
    if (disabled || saving || editing) return;
    setDraft(seedDraft());
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = async () => {
    if (!editing) return;
    const trimmed = draft.trim();
    const seededOriginal = seedDraft().trim();
    if (trimmed === seededOriginal) {
      setEditing(false);
      return;
    }
    let toSave = trimmed;
    if (mode === "number") {
      const n = parseFloat(trimmed);
      if (
        !Number.isFinite(n) ||
        (min !== undefined && n < min) ||
        (max !== undefined && n > max)
      ) {
        setDraft(seededOriginal);
        setEditing(false);
        return;
      }
    } else if (mode === "feet-inches") {
      // Empty clears the field. Anything else must parse cleanly; invalid
      // input reverts silently (same UX as bad number input above).
      if (trimmed.length === 0) {
        toSave = "";
      } else {
        const parsed = parseFeetInches(trimmed);
        if (parsed === null) {
          setDraft(seededOriginal);
          setEditing(false);
          return;
        }
        toSave = String(parsed);
      }
    } else if (trimmed.length === 0) {
      // Don't allow blanking required text fields.
      setDraft(seededOriginal);
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      await onSave(toSave);
      setEditing(false);
    } catch {
      setDraft(seededOriginal);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(seedDraft());
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const handleDisplayKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startEdit();
    }
  };

  const handleDisplayClick = (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    startEdit();
  };

  if (!editing) {
    return (
      <span
        role={disabled ? undefined : "button"}
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        onClick={disabled ? undefined : handleDisplayClick}
        onKeyDown={handleDisplayKeyDown}
        className={cn(
          "block truncate rounded px-1 -mx-1",
          disabled
            ? "cursor-default opacity-70"
            : "cursor-text hover:bg-bg-elevated/70 focus:bg-bg-elevated/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40",
          align === "right" && "text-right",
          className
        )}
      >
        {display}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={mode === "number" ? "decimal" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(
        "w-full rounded border border-accent bg-bg-input px-1.5 py-0.5 text-sm text-text-primary tabular-nums",
        "focus:outline-none focus:ring-1 focus:ring-accent/40",
        saving && "opacity-60",
        align === "right" && "text-right",
        inputClassName
      )}
    />
  );
}
