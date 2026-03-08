"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * iOS-style toggle switch with optional label and description.
 *
 * Uses `role="switch"` and `aria-checked` for screen-reader support.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: ToggleSwitchProps) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-4 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex flex-col">
        {label && (
          <span className="text-sm font-medium text-text-primary">{label}</span>
        )}
        {description && (
          <span className="text-xs text-text-muted">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer",
          checked ? "bg-accent" : "bg-border-default"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white transition-transform duration-200 shadow-sm",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}
