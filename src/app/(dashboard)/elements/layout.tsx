"use client";

import { useTranslations } from "next-intl";
import { useFlag } from "@/hooks/useFlag";
import { SlidingTabsNav } from "@/components/ui/SlidingTabsNav";

interface Props {
  children: React.ReactNode;
}

/**
 * Element Library + Rate Contracts share a top-level tab strip. Each child
 * route renders independently; this layout only owns the tab navigation so
 * the highlighted tab survives across navigations without re-mount.
 */
export default function ElementsLayout({ children }: Props) {
  const t = useTranslations("elements");
  const tRc = useTranslations("rateContracts");
  const rateContractsEnabled = useFlag("rateContracts");

  const tabs = [
    { href: "/elements/library", label: t("tabLibrary"), show: true },
    {
      href: "/elements/rate-contracts",
      label: tRc("tabRateContracts"),
      show: rateContractsEnabled,
    },
  ].filter((tab) => tab.show);

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 && (
        <div className="border-b border-border-default">
          <SlidingTabsNav
            tabs={tabs}
            className="flex gap-1 -mb-px"
            linkClassName="px-4 py-2.5 text-sm font-medium transition-colors"
            activeLinkClassName="text-text-primary"
            inactiveLinkClassName="text-text-muted hover:text-text-primary"
            indicatorClassName="bottom-0 h-0.5 bg-accent"
          />
        </div>
      )}
      {children}
    </div>
  );
}
