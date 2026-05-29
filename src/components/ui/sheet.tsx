"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalOverlay } from "@/components/ui/ModalOverlay";

const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

/**
 * Slide animation duration in ms — kept in sync with the close keyframe
 * timing in `globals.css` (the actual animation, not via Tailwind).
 * Exported so callers that need to sequence state changes around the
 * close animation (e.g. swap drawer contents *after* the slide-out
 * finishes) don't have to hardcode it.
 */
export const SHEET_TRANSITION_MS = 600;

/** Re-export for legacy imports; new code should use `ModalOverlay`. */
const SheetOverlay = ModalOverlay;

/**
 * Vanilla Radix lifecycle — NO `forceMount`. Portal/Overlay/Content
 * must all unmount on close so `react-remove-scroll` (wrapped around
 * Content internally) runs its cleanup: removes body's inline
 * `pointer-events: none`, clears `data-scroll-locked`, and detaches
 * the global wheel / touch listeners that otherwise lock the page
 * until a hard reload.
 *
 * Trade-off: Radix's `Presence` sometimes misses our CSS `animation`
 * declarations when reading `getComputedStyle.animationName` during
 * the open → closed flip, so the close can snap rather than slide.
 * The smooth-close UX isn't worth a locked page.
 */
const Sheet = DialogPrimitive.Root;

interface SheetContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: "right" | "left";
}

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "right", ...props }, ref) => {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-sheet-slide
        data-sheet-side={side}
        className={cn(
          "fixed top-0 bottom-0 z-50 flex flex-col w-full sm:max-w-md lg:max-w-lg bg-bg-secondary shadow-2xl border-border-default",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          "data-[state=closed]:pointer-events-none",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-bg-primary transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:pointer-events-none cursor-pointer">
          <X className="h-4 w-4 text-text-muted" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

/** Header area of a Sheet — sticky top padding matches content. */
function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-6 pt-6 pb-4 border-b border-border-default",
        className
      )}
      {...props}
    />
  );
}
SheetHeader.displayName = "SheetHeader";

/** Scrollable body area of a Sheet. */
function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-6 py-4", className)}
      {...props}
    />
  );
}
SheetBody.displayName = "SheetBody";

/** Footer area of a Sheet — typically holds primary/secondary actions. */
function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-row justify-end gap-2 px-6 py-4 border-t border-border-default",
        className
      )}
      {...props}
    />
  );
}
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-text-primary",
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-text-secondary", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
