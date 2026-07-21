"use client";

import type { ReactNode } from "react";
import { useSlide } from "./useSlide";

/**
 * The single right-side drawer that hosts the Comments / Reviews / Revisions
 * bodies. It owns the open/close slide animation, so switching between the
 * three panels only swaps the body (no close-and-reopen) — the drawer only
 * animates when it opens from closed or closes to nothing.
 */
export function ReviewSidePanel({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const { shouldRender, stage } = useSlide(open);
  if (!shouldRender) return null;

  return (
    <div
      className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border-default bg-bg-primary transition-[width,opacity] duration-200 ease-out"
      style={{
        width: stage === "in" ? undefined : 0,
        opacity: stage === "in" ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}
