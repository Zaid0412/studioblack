"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * Shared backdrop used by both the centered `Dialog` and the side-anchored
 * `Sheet`. Extracted so the two primitives don't drift on animation or
 * blur tuning.
 */
export const ModalOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-modal-overlay
    className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", className)}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";
