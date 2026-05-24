"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUserRole } from "@/hooks/useUserRole";
import { tabsForRole } from "../_lib/tabs";

interface BoqSubTabStripProps {
  projectId: string;
}

/**
 * Horizontal sub-tab strip under the BOQ workflow step. Driven entirely
 * by `VISIBLE_BOQ_TABS` in `_lib/tabs.ts` — flipping a tab's `enabled`
 * flag surfaces it here. Tabs marked with a `roles` whitelist are filtered
 * against the current viewer's role (e.g. RFQ is studio-only).
 *
 * Active tab is detected by prefix-matching the pathname against each
 * tab's full route, so future nested sub-routes (e.g. `/boq/rfq/new`)
 * still highlight their parent tab.
 */
export function BoqSubTabStrip({ projectId }: BoqSubTabStripProps) {
  const pathname = usePathname();
  const { role } = useUserRole();
  const t = useTranslations("boq.tabs");
  const baseHref = `/projects/${projectId}/boq`;
  const visibleTabs = tabsForRole(role);

  return (
    <nav
      aria-label="BOQ sub-tabs"
      className="shrink-0 flex items-center gap-6 px-4 lg:px-10 border-b-2 border-border-default overflow-x-auto scrollbar-none"
    >
      {visibleTabs.map((tab) => {
        const tabHref = `${baseHref}/${tab.segment}`;
        const isActive =
          pathname === tabHref || pathname.startsWith(`${tabHref}/`);
        return (
          <Link
            key={tab.segment}
            href={tabHref}
            aria-current={isActive ? "page" : undefined}
            className={`relative py-3 text-sm whitespace-nowrap transition-colors ${
              isActive
                ? "font-semibold text-text-primary"
                : "font-medium text-text-muted hover:text-text-primary"
            }`}
          >
            {t(tab.labelKey)}
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
