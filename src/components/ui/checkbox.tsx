"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

/**
 * Styled checkbox with animated check icon.
 *
 * Uses a hidden native `<input>` for accessibility (keyboard, forms, screen readers)
 * and a visual overlay styled to match the design system.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked = false,
      indeterminate = false,
      onCheckedChange,
      label,
      description,
      disabled,
      className,
      id,
      ...rest
    },
    ref
  ) => {
    const isActive = checked || indeterminate;

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-start gap-2.5 cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {/* Hidden native checkbox for a11y */}
        <input
          ref={ref}
          type="checkbox"
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only peer"
          {...rest}
        />

        {/* Visual box */}
        <span
          className={cn(
            "relative mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150",
            isActive
              ? "border-accent bg-accent"
              : "border-border-light bg-bg-secondary hover:border-text-muted",
            disabled && "pointer-events-none"
          )}
        >
          {checked && !indeterminate && (
            <Check className="h-3 w-3 text-text-on-accent" strokeWidth={3} />
          )}
          {indeterminate && (
            <Minus className="h-3 w-3 text-text-on-accent" strokeWidth={3} />
          )}
        </span>

        {/* Label + description */}
        {(label || description) && (
          <span className="flex flex-col gap-0.5 min-w-0">
            {label && (
              <span className="text-[12px] font-medium leading-tight text-text-primary">
                {label}
              </span>
            )}
            {description && (
              <span className="text-[11px] leading-snug text-text-muted">
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
export type { CheckboxProps };
