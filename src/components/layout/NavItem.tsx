"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActiveRoute } from "@/lib/nav";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /**
   * Route to match for the active state, when it should be broader than the
   * link target. E.g. Elements links to `/elements/library` but is active
   * across the whole `/elements` section. Defaults to `href`.
   */
  activeHref?: string;
  /** When `true`, renders the item in compact icon-only mode with a tooltip. */
  isCollapsed?: boolean;
}

/**
 * Sidebar navigation link with icon, label, and optional notification badge.
 *
 * Highlights automatically when the current pathname matches `href`.
 * In collapsed mode, text and badge fade out smoothly via CSS transitions
 * while a small dot overlay appears on the icon. The sidebar's
 * `overflow-hidden` clips any remaining content. A right-side tooltip
 * displays the label.
 */
export function NavItem({
  href,
  label,
  icon: Icon,
  badge,
  activeHref,
  isCollapsed,
}: NavItemProps) {
  const pathname = usePathname();
  const isActive = isActiveRoute(pathname, href, activeHref);

  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-lg text-sm font-medium w-full overflow-hidden transition-all duration-200 py-2.5",
        isCollapsed ? "justify-center gap-0 px-3" : "gap-3 px-4",
        isActive
          ? "bg-bg-elevated text-accent-strong font-semibold"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
      )}
    >
      <span className="relative shrink-0">
        <Icon className="h-[18px] w-[18px]" />
        {badge !== undefined && badge > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent transition-opacity duration-200",
              isCollapsed ? "opacity-100" : "opacity-0"
            )}
          />
        )}
      </span>
      <span
        className={cn(
          "flex-1 truncate whitespace-nowrap transition-opacity duration-200",
          isCollapsed ? "hidden" : "opacity-100"
        )}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-text-on-accent text-xs font-semibold whitespace-nowrap transition-opacity duration-200",
            isCollapsed ? "hidden" : "opacity-100"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
