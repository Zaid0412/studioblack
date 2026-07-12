"use client";

import { useTranslations } from "next-intl";
import { SlidingTabsNav } from "@/components/ui/SlidingTabsNav";

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
 * Thin adapter over `SlidingTabsNav` — resolves segments + i18n into hrefs and
 * labels, then hands off active detection and the sliding underline.
 *
 * Renders nothing when only one tab is visible — a single-item strip is just
 * chrome with no choice.
 */
export function WorkflowSubTabStrip({
  basePath,
  tabs,
  i18nNamespace,
}: WorkflowSubTabStripProps) {
  const t = useTranslations(i18nNamespace);

  return (
    <SlidingTabsNav
      hideWhenSingle
      ariaLabel={t("ariaLabel")}
      tabs={tabs.map((tab) => ({
        href: `${basePath}/${tab.segment}`,
        label: t(tab.labelKey),
      }))}
      className="shrink-0 flex items-center gap-6 px-4 lg:px-10 border-b-2 border-border-default overflow-x-auto scrollbar-none"
      linkClassName="py-3 text-sm whitespace-nowrap transition-colors"
      activeLinkClassName="font-semibold text-text-primary"
      inactiveLinkClassName="font-medium text-text-muted hover:text-text-primary"
      indicatorClassName="bottom-0 h-1 rounded-t-sm bg-accent"
    />
  );
}
