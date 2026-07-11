"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";

export interface WorkflowSubTab {
  /** i18n key resolved against `i18nNamespace`. */
  labelKey: string;
  /** URL segment appended to `basePath`. */
  segment: string;
}

interface WorkflowSubTabStripProps {
  /** Absolute path under which each tab's `segment` appends. e.g. `/projects/123/boq`. */
  basePath: string;
  /** Already filtered against the viewer's role. */
  tabs: readonly WorkflowSubTab[];
  /**
   * next-intl namespace, e.g. `boq.tabs` or `order.tabs`. Must contain an
   * `ariaLabel` key (the nav landmark name) alongside the per-tab labels.
   */
  i18nNamespace: string;
}

/**
 * Horizontal sub-tab strip used under a workflow step (BOQ, Order, ...).
 *
 * Active tab is detected by prefix-matching the pathname against each
 * tab's full route, so nested sub-routes (e.g. `/order/rfq/new`) still
 * highlight their parent tab.
 *
 * Renders nothing when only one tab is visible — a single-item strip is
 * just chrome with no choice.
 */
export function WorkflowSubTabStrip({
  basePath,
  tabs,
  i18nNamespace,
}: WorkflowSubTabStripProps) {
  const pathname = usePathname();
  const t = useTranslations(i18nNamespace);

  const navRef = useRef<HTMLElement>(null);
  const activeTab = tabs.find((tab) => {
    const tabHref = `${basePath}/${tab.segment}`;
    return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
  });
  const indicator = useSlidingIndicator(navRef, activeTab?.segment);

  if (tabs.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      aria-label={t("ariaLabel")}
      className="relative shrink-0 flex items-center gap-6 px-4 lg:px-10 border-b-2 border-border-default overflow-x-auto scrollbar-none"
    >
      {tabs.map((tab) => {
        const tabHref = `${basePath}/${tab.segment}`;
        const isActive =
          pathname === tabHref || pathname.startsWith(`${tabHref}/`);
        return (
          <Link
            key={tab.segment}
            href={tabHref}
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            className={`py-3 text-sm whitespace-nowrap transition-colors ${
              isActive
                ? "font-semibold text-text-primary"
                : "font-medium text-text-muted hover:text-text-primary"
            }`}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
      <span
        aria-hidden="true"
        className="absolute bottom-0 h-1 bg-accent rounded-t-sm transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </nav>
  );
}
