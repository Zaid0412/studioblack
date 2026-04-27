"use client";

import type { FormEvent, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitFooter } from "@/components/ui/SubmitFooter";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Form submit handler. Called with the native event so callers can preventDefault. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  /** Disables the submit button + swaps its label. */
  submitting: boolean;
  submitLabel: string;
  submittingLabel?: string;
  children: ReactNode;
}

/**
 * Standard create/edit dialog: a Radix Dialog with header + a vertical form
 * body and a `SubmitFooter`. Keeps every CRUD dialog visually consistent and
 * removes the modal/form scaffolding from each call site.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {children}
          <SubmitFooter
            submitting={submitting}
            submitLabel={submitLabel}
            submittingLabel={submittingLabel}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
