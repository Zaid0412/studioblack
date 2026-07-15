"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A vertical settings-nav entry — shared by the global and per-project settings pages. */
export function SettingsNavLink({
  href,
  icon: Icon,
  label,
  isActive,
  danger,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-bg-elevated text-text-primary font-medium"
          : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
        danger && !isActive && "text-error/80 hover:text-error"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
