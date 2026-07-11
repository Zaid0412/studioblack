"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useFlag } from "@/hooks/useFlag";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();
  const rateContractsEnabled = useFlag("rateContracts");

  const tabs: { href: string; label: string; show: boolean }[] = [
    {
      href: "/elements/library",
      label: t("tabLibrary"),
      show: true,
    },
    {
      href: "/elements/rate-contracts",
      label: tRc("tabRateContracts"),
      show: rateContractsEnabled,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.show);

  const navRef = useRef<HTMLElement>(null);
  const activeTab = visibleTabs.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  );
  const indicator = useSlidingIndicator(navRef, activeTab?.href);

  return (
    <div className="flex flex-col gap-4">
      {visibleTabs.length > 1 && (
        <div className="border-b border-border-default">
          <nav ref={navRef} className="relative flex gap-1 -mb-px">
            {visibleTabs.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  data-active={isActive}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "text-text-primary"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
            <span
              aria-hidden
              className="absolute bottom-0 h-0.5 bg-accent transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
              style={{ left: indicator.left, width: indicator.width }}
            />
          </nav>
        </div>
      )}
      {children}
    </div>
  );
}
