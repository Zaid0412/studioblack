"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { SlidingIndicator } from "@/components/ui/SlidingIndicator";
import { cn } from "@/lib/utils";

export interface SlidingTab {
  href: string;
  label: string;
}

interface Props {
  tabs: readonly SlidingTab[];
  /** Nav landmark name. */
  ariaLabel?: string;
  /** Classes for the `<nav>` (it is already `relative`). */
  className?: string;
  /** Base classes applied to every tab link. */
  linkClassName?: string;
  activeLinkClassName?: string;
  inactiveLinkClassName?: string;
  /** Look of the sliding indicator, e.g. `"bottom-0 h-0.5 bg-accent"`. */
  indicatorClassName?: string;
  /** Render nothing when there's only one tab (a lone tab is just chrome). */
  hideWhenSingle?: boolean;
}

/**
 * Route-driven tab strip with a sliding active indicator. Active tab is
 * prefix-matched against the pathname so nested sub-routes still highlight
 * their parent tab. Callers own the look; this owns the active detection,
 * measurement and indicator.
 */
export function SlidingTabsNav({
  tabs,
  ariaLabel,
  className,
  linkClassName,
  activeLinkClassName,
  inactiveLinkClassName,
  indicatorClassName,
  hideWhenSingle,
}: Props) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const activeTab = tabs.find((tab) => isActive(tab.href));
  const indicator = useSlidingIndicator(navRef, activeTab?.href);

  if (hideWhenSingle && tabs.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={cn("relative", className)}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              linkClassName,
              active ? activeLinkClassName : inactiveLinkClassName
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      <SlidingIndicator
        style={{ left: indicator.left, width: indicator.width }}
        className={indicatorClassName}
      />
    </nav>
  );
}
