import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

/**
 * A form field's label, plus the shared "required" marker.
 *
 * The marker was hand-rolled in a dozen places and had already drifted —
 * `text-error` vs `text-danger`, with or without the `ml-0.5`, `aria-hidden` on
 * one of them. It's decorative: the accessible signal is `aria-required` on the
 * control itself, so it's hidden from screen readers rather than read out as a
 * stray asterisk.
 *
 * `Input`, `LabeledSelect`, `LabeledSearchableSelect` and `DatePicker` still
 * carry their own copies; they should move onto this.
 */
export function FieldLabel({ required, className, children, ...props }: Props) {
  return (
    <label
      className={cn("text-[13px] font-medium text-text-secondary", className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-error ml-0.5" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}
