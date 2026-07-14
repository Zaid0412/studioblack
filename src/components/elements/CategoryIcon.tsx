"use client";

import { icons, Folder, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryIconProps {
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

/**
 * Renders a lucide icon by PascalCase name, tinted by `color`.
 * Falls back to `<Folder>` in muted gray when either prop is missing or unresolved.
 */
export function CategoryIcon({
  icon,
  color,
  size = 16,
  className,
}: CategoryIconProps) {
  const Resolved =
    (icon && (icons as Record<string, LucideIcon>)[icon]) || null;
  // Never shrink: every call site sits in a flex row beside truncating text,
  // and a squashed icon reads as a rendering fault rather than as tight space.
  if (!Resolved) {
    return (
      <Folder
        className={cn("shrink-0 text-text-muted", className)}
        size={size}
        aria-hidden
      />
    );
  }
  return (
    <Resolved
      className={cn("shrink-0", className)}
      size={size}
      style={color ? { color } : undefined}
      aria-hidden
    />
  );
}
