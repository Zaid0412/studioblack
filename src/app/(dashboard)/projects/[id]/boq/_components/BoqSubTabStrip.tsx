"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VISIBLE_BOQ_TABS } from "../_lib/tabs";

interface BoqSubTabStripProps {
  projectId: string;
}

/**
 * Horizontal sub-tab strip under the BOQ workflow step. Renders one
 * `<Link>` per entry in `VISIBLE_BOQ_TABS` — driven by the constants
 * file in `_lib/tabs.ts`, so flipping a tab's `enabled` flag is the
 * only change needed to surface it here.
 *
 * The active tab is resolved from the current pathname's last
 * segment.
 */
export function BoqSubTabStrip({ projectId }: BoqSubTabStripProps) {
  const pathname = usePathname();
  const activeSegment = pathname.split("/").pop();

  return (
    <nav
      aria-label="BOQ sub-tabs"
      className="shrink-0 flex items-center gap-6 px-4 lg:px-10 border-b-2 border-border-default overflow-x-auto scrollbar-none"
    >
      {VISIBLE_BOQ_TABS.map((tab) => {
        const isActive = tab.segment === activeSegment;
        return (
          <Link
            key={tab.key}
            href={`/projects/${projectId}/boq/${tab.segment}`}
            aria-current={isActive ? "page" : undefined}
            className={`relative py-3 text-sm whitespace-nowrap transition-colors ${
              isActive
                ? "font-semibold text-text-primary"
                : "font-medium text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1 bg-accent rounded-t-sm"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
