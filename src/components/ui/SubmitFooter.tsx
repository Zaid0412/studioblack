"use client";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

interface SubmitFooterProps {
  submitting: boolean;
  /** Label for the primary button when idle. */
  submitLabel: string;
  /** Label while submitting. Defaults to `${submitLabel}...`. */
  submittingLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Omit or set false to hide the cancel button. */
  showCancel?: boolean;
  /** Submit button variant. Defaults to "primary". */
  submitVariant?: "primary" | "danger";
  /** When true, the primary button is disabled even if not submitting. */
  disabled?: boolean;
  /**
   * Provide to switch the primary button from `type="submit"` to a plain
   * button that fires this handler. Useful for dialogs that don't wrap
   * their content in a `<form>` (e.g. pickers where Enter shouldn't fire).
   */
  onSubmit?: () => void;
}

/**
 * Standard Cancel + Submit footer for form dialogs. Cancel closes the
 * dialog via Radix `DialogClose`; Submit is a `type="submit"` so it
 * triggers the wrapping `<form>`'s onSubmit.
 */
export function SubmitFooter({
  submitting,
  submitLabel,
  submittingLabel,
  cancelLabel = "Cancel",
  showCancel = true,
  submitVariant = "primary",
  disabled,
  onSubmit,
}: SubmitFooterProps) {
  return (
    <DialogFooter className="gap-2">
      {showCancel && (
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={submitting}>
            {cancelLabel}
          </Button>
        </DialogClose>
      )}
      <Button
        type={onSubmit ? "button" : "submit"}
        variant={submitVariant}
        disabled={submitting || disabled}
        onClick={onSubmit}
      >
        {submitting ? (submittingLabel ?? `${submitLabel}...`) : submitLabel}
      </Button>
    </DialogFooter>
  );
}
